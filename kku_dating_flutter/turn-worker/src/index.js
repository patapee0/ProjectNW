import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_KEYS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (origin === allowedOrigin) headers['Access-Control-Allow-Origin'] = allowedOrigin;
  return headers;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

async function sha1Hex(value) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function deleteCloudinaryImage(publicId, uid, env) {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return { error: 'cloudinary_worker_secrets_not_configured', status: 503 };
  }
  // Only allow an asset path scoped to the authenticated user's Firebase UID.
  if (typeof publicId !== 'string' || !publicId.startsWith(`kku_profiles/${uid}/`)
      || !/^kku_profiles\/[A-Za-z0-9_-]+\/[0-9]+$/.test(publicId)) {
    return { error: 'invalid_public_id', status: 400 };
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await sha1Hex(`public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`);
  const body = new URLSearchParams({ public_id: publicId, timestamp, api_key: env.CLOUDINARY_API_KEY, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const result = await response.json();
  if (!response.ok || !['ok', 'not found'].includes(result.result)) {
    return { error: 'cloudinary_delete_failed', status: 502 };
  }
  return { result: result.result };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);
    if (origin && origin !== env.ALLOWED_ORIGIN) return json({ error: 'origin_not_allowed' }, 403, headers);

    try {
      const authorization = request.headers.get('Authorization') ?? '';
      if (!authorization.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, headers);
      const token = authorization.slice('Bearer '.length);
      const { payload } = await jwtVerify(token, GOOGLE_KEYS, {
        audience: env.FIREBASE_PROJECT_ID,
        issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      });
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
      if (payload.email_verified !== true || !email.endsWith('@kkumail.com')) {
        return json({ error: 'verified_kku_account_required' }, 403, headers);
      }

      if (new URL(request.url).pathname === '/delete-profile-image') {
        if (typeof payload.sub !== 'string') return json({ error: 'invalid_token' }, 401, headers);
        const body = await request.json();
        const deletion = await deleteCloudinaryImage(body?.publicId, payload.sub, env);
        return deletion.error
          ? json({ error: deletion.error }, deletion.status, headers)
          : json({ result: deletion.result }, 200, headers);
      }

      if (new URL(request.url).pathname !== '/turn-credentials') {
        return json({ error: 'not_found' }, 404, headers);
      }
      if (!env.TURN_KEY_ID || env.TURN_KEY_ID === 'SET_IN_CLOUDFLARE_DASHBOARD' || !env.TURN_API_TOKEN) {
        return json({ error: 'turn_service_not_configured' }, 503, headers);
      }

      const turnResponse = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.TURN_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: 3600 }),
        },
      );
      if (!turnResponse.ok) return json({ error: 'turn_credentials_unavailable' }, 502, headers);

      const data = await turnResponse.json();
      const iceServers = Array.isArray(data.iceServers)
        ? data.iceServers.map((server) => ({
            ...server,
            // Cloudflare notes that port 53 can time out in browsers; trickle ICE is used here.
            urls: Array.isArray(server.urls)
              ? server.urls.filter((url) => !/:53(?:\?|$)/.test(url))
              : server.urls,
          }))
        : [];
      if (!iceServers.some((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) => typeof url === 'string' && (url.startsWith('turn:') || url.startsWith('turns:')));
      })) return json({ error: 'turn_servers_missing' }, 502, headers);

      return json({ iceServers }, 200, headers);
    } catch (_) {
      return json({ error: 'invalid_token_or_service_error' }, 401, headers);
    }
  },
};
