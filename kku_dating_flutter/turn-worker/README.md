# TURN credentials endpoint

This Cloudflare Worker keeps the long-lived Cloudflare TURN API token off the Flutter app. It validates Firebase ID tokens and only issues short-lived relay credentials to verified `@kkumail.com` users.

## Configure and deploy

1. In Cloudflare Realtime, create a TURN key and note its key ID. Cloudflare's TURN key API token is a secret; do not put it in Flutter or commit it.
2. Set `TURN_KEY_ID` in `wrangler.toml` to the key ID.
3. From this directory, install the packages, set the secret with `npx wrangler secret put TURN_API_TOKEN`, and deploy with `npx wrangler deploy`.
4. Set the deployed endpoint URL as `TURN_CREDENTIALS_ENDPOINT` when building Flutter web and Android:

   ```powershell
   flutter build web --dart-define=TURN_CREDENTIALS_ENDPOINT=https://YOUR-WORKER.workers.dev/
   flutter build apk --dart-define=TURN_CREDENTIALS_ENDPOINT=https://YOUR-WORKER.workers.dev/
   ```

5. Deploy the web build to Firebase Hosting and install the new Android APK. Both clients must be updated to use TURN.

Cloudflare documents TURN usage as free for the first 1,000 GB and $0.05 per outbound GB thereafter. Check the current account plan and usage before enabling it for real users.
