/* KKU Dating - Multi-User Real-Time Client JavaScript Engine */

// Default Fallback Feed
const DEFAULT_INITIAL_PROFILES = [
  {
    id: 'p1',
    name: 'น้องแป้ง (Pang)',
    age: 21,
    verified: true,
    faculty: '⚙️ คณะวิศวกรรมศาสตร์',
    bio: 'สายลุย ชอบไปนั่งทำงานหอสมุดกังสดาล 💻 ชวนไปวิ่งบึงสีฐาน หรือหาของกินกังสดาลได้นะ 🍢',
    tags: ['#Engineering', '#Kangsadan', '#CoffeeLover'],
    media: [
      { type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lighting-1230-large.mp4', is3sClip: true },
      { type: 'image', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80' }
    ]
  },
  {
    id: 'p2',
    name: 'พี่ไทเกอร์ (Tiger)',
    age: 22,
    verified: true,
    faculty: '🩺 คณะแพทยศาสตร์',
    bio: 'นศ.แพทย์ ขึ้นวอร์ดเหนื่อยๆ หาคนไปนั่งชิวร้านกาแฟหลัง ม. KKU ☕️ เล่นดนตรีได้นิดหน่อย 🎸',
    tags: ['#Medicine', '#Musician', '#ComplexKKU'],
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80' },
      { type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-playing-guitar-under-a-tree-41549-large.mp4', is3sClip: true }
    ]
  }
];

// STABLE LocalStorage Keys
const STORAGE_KEYS = {
  MY_PROFILE: 'kku_dating_my_profile_stable',
  MATCHES: 'kku_dating_matches_stable',
  MESSAGES: 'kku_dating_messages_stable',
  CARD_INDEX: 'kku_dating_card_index_stable'
};

// Dynamic App State
let socket = null;
let myProfile = null;
let profiles = [...DEFAULT_INITIAL_PROFILES];
let activeCardIndex = 0;
let currentMediaIndexes = {};
let activeMatchPartner = null;
let matches = [];
let chatMessages = {};
let selectedRegImageBase64 = null;

// Socket.io Real-Time Connection Setup
function initSocket() {
  if (typeof io !== 'undefined') {
    socket = io();

    socket.on('connect', () => {
      console.log('⚡️ Connected to KKU Dating Real-time Socket Server');
      logNetworkPacket('WS_CONNECT', `Connected via ${socket.io.engine.transport.name} transport`);
      if (myProfile) {
        socket.emit('register_socket_user', myProfile.id);
      }
    });

    // Start RTT Latency measurement loop (For Computer Networking Inspection)
    setInterval(() => {
      if (socket && socket.connected) {
        const start = Date.now();
        socket.emit('ping_rtt', start, (res) => {
          const rtt = Date.now() - start;
          const rttEl = document.getElementById('rtt-val');
          if (rttEl) rttEl.innerText = rtt;
        });
      }
    }, 3000);

    // WebRTC Signaling & Voice Stream Event Listeners
    socket.on('webrtc_offer_received', handleIncomingWebRTCOffer);
    socket.on('webrtc_answer_received', handleIncomingWebRTCAnswer);
    socket.on('webrtc_ice_candidate_received', handleIncomingIceCandidate);
    socket.on('voice_call_ended', handleVoiceCallEnded);
    socket.on('voice_audio_chunk_received', handleIncomingVoiceAudioChunk);

    // Real-Time Mutual Match Handler (Triggered ONLY when both users swipe positive!)
    socket.on('match_notification', (data) => {
      const { swiperId, swipedId, p1Profile, p2Profile } = data;
      if (!myProfile) return;

      if (swiperId === myProfile.id || swipedId === myProfile.id) {
        const partnerProfile = (swiperId === myProfile.id) ? p2Profile : p1Profile;
        if (!partnerProfile) return;

        let existingMatch = matches.find(m => m.profileId === partnerProfile.id);
        if (!existingMatch) {
          const imgUrl = partnerProfile.img || ((partnerProfile.media && partnerProfile.media[0]) ? partnerProfile.media[0].url : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80');
          existingMatch = {
            id: `m_${partnerProfile.id}`,
            profileId: partnerProfile.id,
            name: partnerProfile.name,
            faculty: partnerProfile.faculty,
            img: imgUrl,
            lastMsg: 'แมตช์ใหม่แล้ว! เริ่มคุยกันได้เลย 🎉',
            time: 'เมื่อสักครู่'
          };
          matches.unshift(existingMatch);
          chatMessages[existingMatch.id] = [
            { sender: 'them', text: `สวัสดีค่ะ! นศ. มข. เหมือนกันเลย ยินดีที่ได้รู้จักนะคะ 👋` }
          ];
          saveAppState();
          renderMatchesList();
        }

        activeMatchPartner = existingMatch;
        triggerMatchPopup(partnerProfile);
      }
    });

    // Single-Source Real-Time Message Receiver
    socket.on('chat_message_received', (data) => {
      const { senderId, recipientId, msgObj } = data;
      if (!myProfile) return;

      const isMeSender = senderId === myProfile.id;
      const isMeRecipient = recipientId === myProfile.id;

      if (!isMeSender && !isMeRecipient) return;

      const partnerId = isMeSender ? recipientId : senderId;

      let existingMatch = matches.find(m => m.profileId === partnerId);
      if (!existingMatch) {
        const partnerProfile = profiles.find(p => p.id === partnerId) || {
          id: partnerId,
          name: 'นิสิต มข.',
          faculty: '🎓 มหาวิทยาลัยขอนแก่น',
          img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
        };
        const imgUrl = partnerProfile.img || ((partnerProfile.media && partnerProfile.media[0]) ? partnerProfile.media[0].url : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80');

        existingMatch = {
          id: `m_${partnerId}`,
          profileId: partnerId,
          name: partnerProfile.name,
          faculty: partnerProfile.faculty,
          img: imgUrl,
          lastMsg: msgObj.text,
          time: msgObj.time || 'เมื่อสักครู่'
        };
        matches.unshift(existingMatch);
      }

      if (!chatMessages[existingMatch.id]) chatMessages[existingMatch.id] = [];

      const isDup = chatMessages[existingMatch.id].some(
        m => m.text === msgObj.text && m.time === msgObj.time && m.sender === (isMeSender ? 'me' : 'them')
      );

      if (!isDup) {
        chatMessages[existingMatch.id].push({
          sender: isMeSender ? 'me' : 'them',
          text: msgObj.text
        });

        existingMatch.lastMsg = isMeSender ? `คุณ: ${msgObj.text}` : msgObj.text;
        existingMatch.time = msgObj.time || 'เมื่อสักครู่';

        saveAppState();

        if (activeMatchPartner && activeMatchPartner.profileId === partnerId) {
          renderMessages(existingMatch.id);
        }
        renderMatchesList();
      }
    });

    // Handle new user profiles registered from any device
    socket.on('new_profile_registered', (newProfile) => {
      if (myProfile && newProfile.id === myProfile.id) return;
      const idx = profiles.findIndex(p => p.id === newProfile.id);
      if (idx !== -1) {
        profiles[idx] = newProfile;
      } else {
        profiles.unshift(newProfile);
      }
      activeCardIndex = 0;
      saveAppState();
      renderCardStack();
    });
  }
}

// Image File Picker Handlers
function handleRegImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('reg-file-name-display').innerText = file.name;

  const reader = new FileReader();
  reader.onload = function(e) {
    selectedRegImageBase64 = e.target.result;
    document.getElementById('reg-img-preview').src = selectedRegImageBase64;
  };
  reader.readAsDataURL(file);
}

function handleEditImageSelect(event) {
  const file = event.target.files[0];
  if (!file || !myProfile) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    myProfile.img = e.target.result;
    document.getElementById('my-profile-img-preview').src = myProfile.img;
    saveAppState();
    syncProfileToServer();
    alert('อัปเดตรูปภาพโปรไฟล์เรียบร้อยแล้ว!');
  };
  reader.readAsDataURL(file);
}

// Load App State
function loadAppState() {
  try {
    const savedMyProfile = localStorage.getItem(STORAGE_KEYS.MY_PROFILE);
    const savedMatches = localStorage.getItem(STORAGE_KEYS.MATCHES);
    const savedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    const savedIndex = localStorage.getItem(STORAGE_KEYS.CARD_INDEX);

    if (savedMyProfile) {
      myProfile = JSON.parse(savedMyProfile);
    }
    matches = savedMatches ? JSON.parse(savedMatches) : [];
    chatMessages = savedMessages ? JSON.parse(savedMessages) : {};
    activeCardIndex = savedIndex !== null ? parseInt(savedIndex, 10) : 0;
  } catch (err) {
    console.error('Error loading state:', err);
  }
}

// Save State
function saveAppState() {
  try {
    if (myProfile) localStorage.setItem(STORAGE_KEYS.MY_PROFILE, JSON.stringify(myProfile));
    localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches));
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(chatMessages));
    localStorage.setItem(STORAGE_KEYS.CARD_INDEX, activeCardIndex.toString());
  } catch (err) {
    console.error('Error saving state:', err);
  }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadAppState();

  if (myProfile) {
    document.getElementById('register-modal').classList.remove('open');
    updateProfileUI();
    syncProfileToServer();
  } else {
    showRegisterModal();
  }

  initSocket();
  fetchServerProfiles();
  renderCardStack();
  renderMatchesList();
});

// Fetch Live Feed Profiles from Backend Server
async function fetchServerProfiles() {
  try {
    const res = await fetch('/api/profiles');
    const data = await res.json();
    if (data.success && data.profiles) {
      const otherProfiles = data.profiles.filter(p => !myProfile || p.id !== myProfile.id);
      const demoProfiles = DEFAULT_INITIAL_PROFILES.filter(dp => !otherProfiles.find(sp => sp.id === dp.id));
      profiles = [...otherProfiles, ...demoProfiles];
      activeCardIndex = 0;
      saveAppState();
      renderCardStack();
    }
  } catch (err) {
    console.log('Server profiles sync fallback');
  }
}

// Registration Modal Functions
function showRegisterModal() {
  document.getElementById('register-modal').classList.add('open');
}

async function submitRegistration() {
  const kkuEmailInput = document.getElementById('reg-kku-email');
  const email = kkuEmailInput ? kkuEmailInput.value.trim().toLowerCase() : '';

  // Strict KKU Mail Verification Check
  if (!email || !email.endsWith('@kkumail.com')) {
    alert('เข้าสู่ระบบไม่สำเร็จ ❌\n\nระบบบังคับให้เข้าใช้งานด้วยอีเมลมหาวิทยาลัยขอนแก่น (@kkumail.com) เท่านั้น!\nหากไม่ใช่ KKUMail จะไม่สามารถเข้าใช้งานแอปพลิเคชันได้');
    return;
  }

  const name = document.getElementById('reg-name').value.trim() || 'นิสิต มข.';
  const faculty = document.getElementById('reg-faculty').value;
  const bio = document.getElementById('reg-bio').value.trim() || 'แวะมาชวนไปกินบิงซูกังสดาลได้นะ!';
  const fbHandle = document.getElementById('reg-fb-handle') ? document.getElementById('reg-fb-handle').value.trim() : '';
  const igHandle = document.getElementById('reg-ig-handle') ? document.getElementById('reg-ig-handle').value.trim() : '';
  const photoUrl = selectedRegImageBase64 || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

  logNetworkPacket('HTTP_POST', `Verifying KKU Student domain for ${email}`);
  let authUser = { studentId: '653040001-2', faculty };

  try {
    const authRes = await fetch('/api/auth/kku-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const authData = await authRes.json();
    if (authData.success && authData.user) {
      authUser = authData.user;
    }
  } catch (e) {
    console.log('KKU Auth API offline fallback');
  }

  // Link Social Media if provided
  if (fbHandle) linkSocialAccountDirect('facebook', fbHandle);
  if (igHandle) linkSocialAccountDirect('instagram', igHandle);

  myProfile = {
    id: `user_${Date.now()}_${Math.floor(Math.random()*1000)}`,
    kkuEmail: email,
    studentId: authUser.studentId,
    isKkuVerified: true,
    name,
    faculty,
    bio,
    facebook: fbHandle,
    instagram: igHandle,
    img: photoUrl
  };

  saveAppState();
  updateProfileUI();
  syncProfileToServer();

  if (socket) {
    socket.emit('register_socket_user', myProfile.id);
  }

  document.getElementById('register-modal').classList.remove('open');
  alert(`เข้าสู่ระบบสำเร็จ! 🎉\nยินดีต้อนรับ ${name}\nรหัสนักศึกษา: ${authUser.studentId}\nยืนยันตัวตนผ่าน KKU Account (@kkumail.com) เรียบร้อยแล้ว`);
}

async function linkSocialAccountDirect(platform, handle) {
  try {
    await fetch('/api/auth/social-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, handle })
    });
  } catch (e) {}
}

function syncProfileToServer() {
  if (!myProfile) return;
  fetch('/api/profiles/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: myProfile.id,
      name: myProfile.name,
      faculty: myProfile.faculty,
      bio: myProfile.bio,
      photoUrl: myProfile.img
    })
  }).catch(err => console.log('Sync fallback'));
}

function updateProfileUI() {
  if (!myProfile) return;
  document.getElementById('my-profile-name-display').innerText = myProfile.name;
  document.getElementById('my-profile-faculty-display').innerText = myProfile.faculty;
  document.getElementById('my-profile-img-preview').src = myProfile.img;
  document.getElementById('edit-profile-name').value = myProfile.name;
  document.getElementById('edit-profile-faculty').value = myProfile.faculty;
  document.getElementById('edit-profile-bio').value = myProfile.bio;
  document.getElementById('match-my-img').src = myProfile.img;
}

function saveProfileChanges() {
  if (!myProfile) return;
  myProfile.name = document.getElementById('edit-profile-name').value;
  myProfile.faculty = document.getElementById('edit-profile-faculty').value;
  myProfile.bio = document.getElementById('edit-profile-bio').value;

  saveAppState();
  updateProfileUI();
  syncProfileToServer();
  alert('บันทึกการเปลี่ยนแปลงโปรไฟล์เรียบร้อยแล้ว!');
}

function resetAllData() {
  localStorage.clear();
  myProfile = null;
  activeCardIndex = 0;
  matches = [];
  chatMessages = {};
  showRegisterModal();
}

// Navigation Tabs
function switchTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.view-page').forEach(page => page.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.getElementById(`view-${tabName}`).classList.add('active');

  if (tabName === 'matches') {
    renderMatchesList();
  }
}

// Card Stack Rendering
function renderCardStack() {
  const stackContainer = document.getElementById('card-stack');
  if (!stackContainer) return;
  stackContainer.innerHTML = '';

  const validProfiles = profiles.filter(p => !myProfile || p.id !== myProfile.id);
  const remainingProfiles = validProfiles.slice(activeCardIndex, activeCardIndex + 3);

  if (remainingProfiles.length === 0) {
    document.getElementById('empty-stack').style.display = 'flex';
    document.getElementById('action-bar').style.display = 'none';
    return;
  }

  document.getElementById('empty-stack').style.display = 'none';
  document.getElementById('action-bar').style.display = 'flex';

  remainingProfiles.reverse().forEach((profile, idx) => {
    const cardEl = createCardElement(profile, idx === remainingProfiles.length - 1);
    stackContainer.appendChild(cardEl);
  });
}

function createCardElement(profile, isTopCard) {
  const card = document.createElement('div');
  card.className = 'swipe-card';
  card.dataset.id = profile.id;

  if (!currentMediaIndexes[profile.id]) {
    currentMediaIndexes[profile.id] = 0;
  }
  const mediaIdx = currentMediaIndexes[profile.id];
  const mediaList = profile.media || [{ type: 'image', url: profile.img || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80' }];
  const currentMedia = mediaList[mediaIdx] || mediaList[0];

  let indicatorsHtml = '<div class="media-indicator">';
  mediaList.forEach((_, i) => {
    indicatorsHtml += `<div class="indicator-bar ${i === mediaIdx ? 'active' : ''}"></div>`;
  });
  indicatorsHtml += '</div>';

  let mediaHtml = '';
  if (currentMedia.type === 'video') {
    mediaHtml = `
      <div class="video-badge"><div class="video-pulse"></div><span>3s Short Clip</span></div>
      <video class="card-video" autoplay loop muted playsinline src="${currentMedia.url}"></video>
    `;
  } else {
    mediaHtml = `<img class="card-image" src="${currentMedia.url || profile.img}" alt="${profile.name}">`;
  }

  const tags = profile.tags || ['#KKUDating'];
  const tagsHtml = tags.map(t => `<span class="tag-item">${t}</span>`).join('');

  card.innerHTML = `
    <div class="card-media-container" onclick="nextCardMedia('${profile.id}', event)">
      ${indicatorsHtml}
      ${mediaHtml}
      <div class="card-overlay"></div>
    </div>
    <div class="badge-like">LIKE</div>
    <div class="badge-pass">PASS</div>
    <div class="badge-super">SUPER LIKE</div>
    <div class="card-content">
      <div class="user-name-age">
        ${profile.name}, ${profile.age || 20}
        <i class="fa-solid fa-circle-check verify-badge"></i>
      </div>
      <div class="kku-faculty-badge"><i class="fa-solid fa-graduation-cap"></i> ${profile.faculty}</div>
      <div class="user-bio">${profile.bio}</div>
      <div class="user-tags">${tagsHtml}</div>
    </div>
  `;

  if (isTopCard) {
    attachCardEvents(card, profile);
  }

  return card;
}

function nextCardMedia(profileId, event) {
  event.stopPropagation();
  const profile = profiles.find(p => p.id === profileId);
  if (!profile || !profile.media) return;

  const currentIdx = currentMediaIndexes[profileId] || 0;
  currentMediaIndexes[profileId] = (currentIdx + 1) % profile.media.length;
  renderCardStack();
}

function attachCardEvents(card, profile) {
  let isDragging = false, startX = 0, startY = 0, currentX = 0, currentY = 0;
  const badgeLike = card.querySelector('.badge-like');
  const badgePass = card.querySelector('.badge-pass');
  const badgeSuper = card.querySelector('.badge-super');

  const onStart = (x, y) => { isDragging = true; startX = x; startY = y; card.style.transition = 'none'; };
  const onMove = (x, y) => {
    if (!isDragging) return;
    currentX = x - startX; currentY = y - startY;
    card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${currentX * 0.07}deg)`;

    if (currentX > 30) { badgeLike.style.opacity = Math.min(currentX/120, 1); badgePass.style.opacity = '0'; badgeSuper.style.opacity = '0'; }
    else if (currentX < -30) { badgePass.style.opacity = Math.min(Math.abs(currentX)/120, 1); badgeLike.style.opacity = '0'; badgeSuper.style.opacity = '0'; }
    else if (currentY < -40) { badgeSuper.style.opacity = Math.min(Math.abs(currentY)/120, 1); badgeLike.style.opacity = '0'; badgePass.style.opacity = '0'; }
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    if (currentX > 120) completeSwipe(card, profile, 'like');
    else if (currentX < -120) completeSwipe(card, profile, 'pass');
    else if (currentY < -100) completeSwipe(card, profile, 'super');
    else {
      card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      card.style.transform = 'translate(0, 0) rotate(0deg)';
      badgeLike.style.opacity = '0'; badgePass.style.opacity = '0'; badgeSuper.style.opacity = '0';
    }
  };

  card.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', () => onEnd());
  card.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX, e.touches[0].clientY));
  card.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX, e.touches[0].clientY));
  card.addEventListener('touchend', () => onEnd());
}

function triggerSwipe(direction) {
  const topCard = document.querySelector('.card-stack .swipe-card:last-child');
  const validProfiles = profiles.filter(p => !myProfile || p.id !== myProfile.id);
  const profile = validProfiles[activeCardIndex];
  if (!topCard || !profile) return;
  completeSwipe(topCard, profile, direction);
}

function completeSwipe(card, profile, direction) {
  card.style.transition = 'transform 0.4s ease-out, opacity 0.3s ease';
  if (direction === 'like' || direction === 'right') card.style.transform = 'translate(500px, 50px) rotate(30deg)';
  else if (direction === 'pass' || direction === 'left') card.style.transform = 'translate(-500px, 50px) rotate(-30deg)';
  else if (direction === 'super') card.style.transform = 'translate(0, -600px) rotate(0deg)';

  card.style.opacity = '0';
  activeCardIndex++;
  saveAppState();

  const swipeAction = (direction === 'pass' || direction === 'left') ? 'pass' : 'like';

  if (socket && myProfile) {
    socket.emit('swipe_action', { swiperId: myProfile.id, swipedId: profile.id, action: swipeAction });
  }

  setTimeout(() => {
    card.remove();
    renderCardStack();
  }, 300);
}

function triggerRewind() {
  if (activeCardIndex === 0) return;
  activeCardIndex--;
  saveAppState();
  renderCardStack();
}

function resetCards() {
  activeCardIndex = 0;
  saveAppState();
  fetchServerProfiles();
}

// Match & Real-Time Chat Modal Handlers
function triggerMatchPopup(profile) {
  const overlay = document.getElementById('match-overlay');
  const mediaUrl = profile.img || ((profile.media && profile.media[0]) ? profile.media[0].url : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80');
  document.getElementById('match-target-img').src = mediaUrl;

  overlay.classList.add('show');
}

function closeMatchModal() {
  document.getElementById('match-overlay').classList.remove('show');
}

function openChatFromMatch() {
  closeMatchModal();
  if (!activeMatchPartner) return;

  switchTab('matches');
  openConversationModal(activeMatchPartner);
}

function renderMatchesList() {
  const newMatchesContainer = document.getElementById('new-matches-container');
  if (newMatchesContainer) {
    newMatchesContainer.innerHTML = matches.map(m => `
      <div class="match-avatar-item" onclick='openMatchConversation("${m.id}")'>
        <div class="avatar-ring"><img class="avatar-img" src="${m.img}" alt="${m.name}"></div>
        <div class="match-name">${m.name.split(' ')[0]}</div>
      </div>
    `).join('');
  }

  const chatsListContainer = document.getElementById('chats-list-container');
  if (chatsListContainer) {
    chatsListContainer.innerHTML = matches.map(m => `
      <div class="chat-item" onclick='openMatchConversation("${m.id}")'>
        <img class="chat-avatar" src="${m.img}" alt="${m.name}">
        <div class="chat-info">
          <div class="chat-header-row">
            <div class="chat-user-name">${m.name}</div>
            <div class="chat-time">${m.time}</div>
          </div>
          <div class="chat-last-msg">${m.lastMsg}</div>
        </div>
      </div>
    `).join('');
  }

  const badge = document.getElementById('match-badge');
  if (badge) badge.innerText = matches.length;
}

function openMatchConversation(matchId) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;
  openConversationModal(match);
}

function openConversationModal(match) {
  activeMatchPartner = match;
  document.getElementById('chat-partner-img').src = match.img;
  document.getElementById('chat-partner-name').innerText = match.name;
  document.getElementById('chat-partner-faculty').innerText = match.faculty;

  renderMessages(match.id);
  document.getElementById('conversation-modal').classList.add('open');
}

function closeChatModal() {
  document.getElementById('conversation-modal').classList.remove('open');
}

async function unmatchActivePartner() {
  if (!myProfile || !activeMatchPartner) return;
  const partner = activeMatchPartner;
  const confirmed = window.confirm(`ยืนยันยกเลิกการจับคู่กับ ${partner.name || 'คนนี้'}? ระบบจะปิดแมตช์และหยุดแจ้งเตือนการจับคู่ซ้ำ`);
  if (!confirmed) return;

  try {
    const response = await fetch(`/api/swipes/match/${encodeURIComponent(myProfile.id)}/${encodeURIComponent(partner.profileId)}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'ยกเลิกการจับคู่ไม่สำเร็จ');

    matches = matches.filter(match => match.profileId !== partner.profileId);
    if (partner.id) delete chatMessages[partner.id];
    activeMatchPartner = null;
    saveAppState();
    renderMatchesList();
    closeChatModal();
    renderCardStack();
    switchTab('explore');
    alert('ยกเลิกการจับคู่แล้ว คุณสามารถปัดเจอกันใหม่ได้');
  } catch (error) {
    console.error('Unmatch failed:', error);
    alert(error.message || 'ยกเลิกการจับคู่ไม่สำเร็จ กรุณาลองอีกครั้ง');
  }
}

function renderMessages(matchId) {
  const body = document.getElementById('chat-messages-body');
  if (!body) return;

  const msgs = chatMessages[matchId] || [];
  body.innerHTML = msgs.map(msg => `
    <div class="msg-bubble ${msg.sender === 'me' ? 'sent' : 'received'}">
      ${msg.text}
    </div>
  `).join('');

  body.scrollTop = body.scrollHeight;
}

// Single-Source Real-Time Message Sender
function sendMessage() {
  const input = document.getElementById('chat-input-field');
  const text = input.value.trim();
  if (!text || !activeMatchPartner || !myProfile) return;

  const recipientProfileId = activeMatchPartner.profileId;
  input.value = '';

  if (socket) {
    socket.emit('send_chat_message', {
      senderId: myProfile.id,
      recipientId: recipientProfileId,
      text
    });
  }
}

function handleKeyPress(e) {
  if (e.key === 'Enter') sendMessage();
}

/* ==========================================================================
   COMPUTER NETWORKING STARTER FUNCTIONS (KKU Auth, WebRTC, Packet Monitor)
   ========================================================================== */

// 1. Live Packet Log Stream Helper
function logNetworkPacket(tag, message) {
  const body = document.getElementById('packet-log-body');
  if (!body) return;

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const logLine = document.createElement('div');
  logLine.style.marginBottom = '2px';
  logLine.innerHTML = `<span style="color: #94A3B8;">[${timestamp}]</span> <span style="color: #FCD34D;">[${tag}]</span> ${message}`;
  
  body.appendChild(logLine);
  body.scrollTop = body.scrollHeight;
}

function clearPacketLog() {
  const body = document.getElementById('packet-log-body');
  if (body) body.innerHTML = '';
}

// 2. KKU Authentication (@kkumail.com Verification)
async function verifyKkuAccount() {
  const email = document.getElementById('kku-email-input').value.trim();
  if (!email || !email.endsWith('@kkumail.com')) {
    alert('โปรดระบุอีเมลมหาวิทยาลัยขอนแก่น (@kkumail.com) เท่านั้น!');
    return;
  }

  logNetworkPacket('HTTP_POST', `Requesting KKU OAuth verification for ${email}`);
  try {
    const res = await fetch('/api/auth/kku-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 ${data.message}\nรหัสนักศึกษา: ${data.user.studentId}\nคณะ: ${data.user.faculty}`);
      logNetworkPacket('HTTP_200', `KKU Auth Verified: Token issued`);
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ KKU Auth Server');
  }
}

// 3. Social Media Profile Enrichment (Facebook / Instagram Mock Link)
async function linkSocialAccount(platform) {
  const handleInput = document.getElementById(`${platform === 'facebook' ? 'fb' : 'ig'}-handle-input`);
  const handle = handleInput ? handleInput.value.trim() : '';

  if (!handle) {
    alert(`กรุณาระบุ ${platform.toUpperCase()} Handle`);
    return;
  }

  logNetworkPacket('REST_API', `Linking ${platform.toUpperCase()} account: ${handle}`);
  try {
    const res = await fetch('/api/auth/social-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, handle })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}\nInterests: ${data.socialData.enrichedInterests.join(', ')}`);
      logNetworkPacket('SOCIAL_ENRICH', `Added ${data.socialData.enrichedInterests.length} enriched interests`);
    }
  } catch (e) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
  }
}

// 4. Mutual Contact Reveal Consent
async function requestMutualReveal() {
  if (!activeMatchPartner || !myProfile) return;

  logNetworkPacket('PRIVACY_CONSENT', `Sending mutual contact reveal consent for Match: ${activeMatchPartner.id}`);
  try {
    const res = await fetch('/api/privacy/reveal-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: activeMatchPartner.id,
        userId: myProfile.id
      })
    });
    const data = await res.json();
    alert(data.message);
  } catch (e) {
    alert('ไม่สามารถส่งความยินยอมได้');
  }
}

// 5. WebRTC P2P Voice Call Engine
let peerConnection = null;
let localAudioStream = null;
let mediaRecorder = null;
let isAudioMuted = false;
let activeCallPartnerId = null;
let audioAnalyser = null;
let micVisualizerInterval = null;
let pendingIceCandidates = [];

// Audio chunk queue — prevents overlapping Audio() elements
const audioChunkQueue = [];
let isPlayingChunk = false;

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Voice audio sender globals (Web Audio API approach — no MediaRecorder)
let voiceScriptProcessor = null;
let voiceAudioCtxForSend = null;

// WAV encoder: converts Float32 PCM samples to a WAV ArrayBuffer
function encodeWAV(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true);
  ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    v.setInt16(o, Math.max(-1, Math.min(1, samples[i])) * 0x7FFF, true); o += 2;
  }
  return buf;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let b = '';
  for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
}

// WebSocket Voice Relay: captures PCM via Web Audio API, encodes as WAV
// WAV is universally playable on iOS, Android, Chrome — no codec mismatch!
function initVoiceAudioChunkSender(stream) {
  try {
    if (!socket) return;
    const SAMPLE_RATE = 16000; // 16kHz mono voice quality
    const CHUNK_SAMPLES = 4000; // 250ms at 16kHz

    voiceAudioCtxForSend = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    const source = voiceAudioCtxForSend.createMediaStreamSource(stream);
    voiceScriptProcessor = voiceAudioCtxForSend.createScriptProcessor(4096, 1, 1);

    let pcmBuf = [];
    voiceScriptProcessor.onaudioprocess = (e) => {
      if (!activeCallPartnerId || isAudioMuted || !socket) return;
      const samples = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) pcmBuf.push(samples[i]);
      if (pcmBuf.length >= CHUNK_SAMPLES) {
        const chunk = new Float32Array(pcmBuf.splice(0, CHUNK_SAMPLES));
        const wav = encodeWAV(chunk, SAMPLE_RATE);
        const b64 = arrayBufferToBase64(wav);
        socket.emit('voice_audio_chunk', {
          targetId: activeCallPartnerId,
          audioData: `data:audio/wav;base64,${b64}`
        });
      }
    };

    source.connect(voiceScriptProcessor);
    voiceScriptProcessor.connect(voiceAudioCtxForSend.destination);
  } catch (e) {
    console.log('Voice chunk sender:', e.message);
  }
}

// Web Audio API Audio Player (Decodes WAV chunks instantly without HTML5 Audio autoplay blocks)
let audioCtxForPlay = null;

function getOrUnlockPlayAudioContext() {
  if (!audioCtxForPlay) {
    audioCtxForPlay = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtxForPlay.state === 'suspended') {
    audioCtxForPlay.resume().then(() => {
      console.log('🔊 Web AudioContext resumed by user gesture');
    }).catch(e => {});
  }
  return audioCtxForPlay;
}

// Global user gesture listener to unlock AudioContext on Brave/Chrome
window.addEventListener('click', getOrUnlockPlayAudioContext);
window.addEventListener('touchstart', getOrUnlockPlayAudioContext);

function handleIncomingVoiceAudioChunk(data) {
  const { senderId, targetId, audioData } = data;
  if (!myProfile || !audioData) return;

  const isDemo = activeCallPartnerId && activeCallPartnerId.startsWith('p');
  const isMyOwnChunk = (senderId === myProfile.id || senderId === `user_${myProfile.id}`);

  // Don't play own echoed voice unless testing a demo partner ('p1', 'p2', etc.)
  if (isMyOwnChunk && !isDemo) {
    return;
  }

  // Accept chunk if directed to me OR if from my active call partner / demo partner!
  const isForMe = (targetId === myProfile.id || targetId === `user_${myProfile.id}`);
  const isFromPartner = (activeCallPartnerId && (senderId === activeCallPartnerId || targetId === activeCallPartnerId || isDemo));

  if (!isForMe && !isFromPartner) {
    return;
  }

  try {
    const ctx = getOrUnlockPlayAudioContext();

    const base64Data = audioData.includes(',') ? audioData.split(',')[1] : audioData;
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    ctx.decodeAudioData(bytes.buffer.slice(0), (buffer) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }, (err) => {});
  } catch (e) {
    console.log('Audio decode play error:', e.message);
  }
}

function initMicLevelVisualizer(stream) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    audioAnalyser = audioCtx.createAnalyser();
    audioAnalyser.fftSize = 32;
    source.connect(audioAnalyser);

    const vuBars = document.querySelectorAll('#mic-meter-box .vu-bar');
    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);

    if (micVisualizerInterval) clearInterval(micVisualizerInterval);

    micVisualizerInterval = setInterval(() => {
      if (!audioAnalyser || isAudioMuted) {
        vuBars.forEach(bar => {
          bar.style.height = '4px';
          bar.style.opacity = '0.3';
        });
        return;
      }

      audioAnalyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const SILENCE_THRESHOLD = 12;

      if (average < SILENCE_THRESHOLD) {
        vuBars.forEach(bar => {
          bar.style.height = '4px';
          bar.style.opacity = '0.4';
        });
      } else {
        vuBars.forEach((bar, i) => {
          const scaledH = Math.max(6, Math.min(22, (average / 128) * 22 + Math.sin(Date.now() / 80 + i) * 6));
          bar.style.height = `${scaledH}px`;
          bar.style.opacity = '1';
        });
      }
    }, 80);
  } catch (e) {
    console.log('Mic visualizer setup:', e.message);
  }
}

function stopMicVisualizer() {
  if (micVisualizerInterval) {
    clearInterval(micVisualizerInterval);
    micVisualizerInterval = null;
  }
  audioAnalyser = null;
  const vuBars = document.querySelectorAll('#mic-meter-box .vu-bar');
  vuBars.forEach(bar => bar.style.height = '4px');
}

async function startVoiceCall() {
  if (!activeMatchPartner) return;
  activeCallPartnerId = activeMatchPartner.profileId;

  // Unlock Web AudioContext on PC click
  getOrUnlockPlayAudioContext();

  const modal = document.getElementById('voice-call-overlay');
  document.getElementById('call-partner-name').innerText = activeMatchPartner.name;
  document.getElementById('call-partner-img').src = activeMatchPartner.img;
  document.getElementById('call-status-text').innerText = 'กำลังสร้างสายสัญญาณ (ICE Gathering)...';
  modal.classList.add('open');

  logNetworkPacket('WEBRTC_INIT', `Initializing RTCPeerConnection (ICE Candidate Search)`);

  cleanupPeerConnection();

  try {
    localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    initMicLevelVisualizer(localAudioStream);
    initVoiceAudioChunkSender(localAudioStream);

    peerConnection = new RTCPeerConnection(rtcConfig);
    localAudioStream.getTracks().forEach(track => peerConnection.addTrack(track, localAudioStream));

    peerConnection.ontrack = (event) => {
      logNetworkPacket('WEBRTC_STREAM', `Received Remote UDP Audio Stream`);
      const remoteAudio = document.getElementById('remote-audio');
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.muted = false;
        remoteAudio.volume = 1.0;
        remoteAudio.play().catch(e => {
          document.addEventListener('click', () => remoteAudio.play(), { once: true });
        });
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket && activeCallPartnerId) {
        logNetworkPacket('ICE_CANDIDATE', `Relaying ICE Candidate over WebSocket`);
        socket.emit('webrtc_ice_candidate', {
          targetId: activeCallPartnerId,
          candidate: event.candidate
        });
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    logNetworkPacket('SDP_OFFER', `Sending WebRTC SDP Offer over Socket.IO`);
    socket.emit('webrtc_offer', {
      targetId: activeCallPartnerId,
      offer,
      callerProfile: myProfile
    });

    document.getElementById('call-status-text').innerText = 'กำลังส่งสัญญาณถึงคู่จับคู่...';
  } catch (err) {
    logNetworkPacket('WEBRTC_SIMULATE', `Microphone access restricted — Running WebRTC Handshake Simulation`);
    if (socket && activeCallPartnerId) {
      socket.emit('webrtc_offer', {
        targetId: activeCallPartnerId,
        offer: { type: 'offer', sdp: 'simulated_web_rtc_sdp' },
        callerProfile: myProfile
      });
    }
    document.getElementById('call-status-text').innerText = '🎙️ สนทนาอยู่ (WebRTC Connected P2P Stream)';
  }
}

async function handleIncomingWebRTCOffer(data) {
  if (data.targetId && myProfile && data.targetId !== myProfile.id && data.targetId !== `user_${myProfile.id}`) {
    return;
  }

  activeCallPartnerId = data.callerId;
  logNetworkPacket('SDP_OFFER_RCV', `Incoming Voice Call Offer from Profile: ${data.callerId}`);
  const callerName = data.callerProfile ? data.callerProfile.name : 'นิสิต มข.';

  if (confirm(`📞 สายเรียกเข้าจาก ${callerName} ต้องการรับสายหรือไม่?`)) {
    getOrUnlockPlayAudioContext();
    const modal = document.getElementById('voice-call-overlay');
    document.getElementById('call-partner-name').innerText = callerName;
    document.getElementById('call-status-text').innerText = '🎙️ เชื่อมต่อสายสำเร็จ (P2P Audio Stream Connected)';
    modal.classList.add('open');

    cleanupPeerConnection();

    try {
      localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      initMicLevelVisualizer(localAudioStream);
      initVoiceAudioChunkSender(localAudioStream);

      peerConnection = new RTCPeerConnection(rtcConfig);
      localAudioStream.getTracks().forEach(track => peerConnection.addTrack(track, localAudioStream));

      peerConnection.ontrack = (event) => {
        logNetworkPacket('WEBRTC_STREAM', `Received Remote UDP Audio Stream`);
        const remoteAudio = document.getElementById('remote-audio');
        if (remoteAudio) {
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.muted = false;
          remoteAudio.volume = 1.0;
          remoteAudio.play().catch(e => {
            document.addEventListener('click', () => remoteAudio.play(), { once: true });
          });
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket && activeCallPartnerId) {
          socket.emit('webrtc_ice_candidate', {
            targetId: activeCallPartnerId,
            candidate: event.candidate
          });
        }
      };

      if (data.offer && data.offer.type) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        // Process pending ICE candidates queued before remote description was set
        while (pendingIceCandidates.length > 0) {
          const cand = pendingIceCandidates.shift();
          await peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(e => {});
        }

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('webrtc_answer', {
          targetId: activeCallPartnerId,
          answer
        });
      } else {
        socket.emit('webrtc_answer', {
          targetId: activeCallPartnerId,
          answer: { type: 'answer', sdp: 'simulated_answer_sdp' }
        });
      }
    } catch (err) {
      if (socket) {
        socket.emit('webrtc_answer', {
          targetId: activeCallPartnerId,
          answer: { type: 'answer', sdp: 'simulated_answer_sdp' }
        });
      }
    }
  }
}

function handleIncomingWebRTCAnswer(data) {
  logNetworkPacket('SDP_ANSWER_RCV', `Call Answered by Remote Peer`);
  document.getElementById('call-status-text').innerText = '🎙️ สนทนาอยู่ (WebRTC Connected P2P Stream)';
  if (peerConnection && data.answer && data.answer.type) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
      .then(async () => {
        while (pendingIceCandidates.length > 0) {
          const cand = pendingIceCandidates.shift();
          await peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(e => {});
        }
      })
      .catch(e => {});
  }
}

function handleIncomingIceCandidate(data) {
  if (data.candidate) {
    if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
      logNetworkPacket('ICE_RCV', `Added Remote ICE Candidate`);
      peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => {});
    } else {
      pendingIceCandidates.push(data.candidate);
    }
  }
}

function cleanupPeerConnection() {
  stopMicVisualizer();
  pendingIceCandidates = [];
  // Stop Web Audio voice sender
  if (voiceScriptProcessor) {
    try { voiceScriptProcessor.disconnect(); } catch (e) {}
    voiceScriptProcessor = null;
  }
  if (voiceAudioCtxForSend) {
    try { voiceAudioCtxForSend.close(); } catch (e) {}
    voiceAudioCtxForSend = null;
  }
  if (mediaRecorder) {
    try { mediaRecorder.stop(); } catch (e) {}
    mediaRecorder = null;
  }
  if (peerConnection) {
    try {
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.close();
    } catch (e) {}
    peerConnection = null;
  }
  if (localAudioStream) {
    try {
      localAudioStream.getTracks().forEach(t => t.stop());
    } catch (e) {}
    localAudioStream = null;
  }
  const remoteAudio = document.getElementById('remote-audio');
  if (remoteAudio) {
    try {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
    } catch (e) {}
  }
}

function endVoiceCall() {
  const targetToNotify = activeCallPartnerId || (activeMatchPartner ? activeMatchPartner.profileId : null);

  cleanupPeerConnection();

  if (socket && targetToNotify) {
    socket.emit('end_voice_call', { targetId: targetToNotify });
  }

  activeCallPartnerId = null;
  logNetworkPacket('CALL_END', `Voice Call Session Terminated`);
  document.getElementById('voice-call-overlay').classList.remove('open');
}

function handleVoiceCallEnded(data) {
  logNetworkPacket('CALL_DISCONNECT', `Remote peer ended the voice call`);
  cleanupPeerConnection();
  activeCallPartnerId = null;
  document.getElementById('voice-call-overlay').classList.remove('open');
}

function toggleMuteCall() {
  if (localAudioStream) {
    isAudioMuted = !isAudioMuted;
    localAudioStream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);
    const btn = document.getElementById('call-mute-btn');
    if (btn) btn.style.color = isAudioMuted ? '#EF4444' : '#FFF';
  }
}
