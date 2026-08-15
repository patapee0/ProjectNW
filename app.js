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
      if (myProfile) {
        socket.emit('register_socket_user', myProfile.id);
      }
    });

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

function submitRegistration() {
  const name = document.getElementById('reg-name').value.trim() || 'นิสิต มข.';
  const faculty = document.getElementById('reg-faculty').value;
  const bio = document.getElementById('reg-bio').value.trim() || 'แวะมาชวนไปกินบิงซูกังสดาลได้นะ!';
  const photoUrl = selectedRegImageBase64 || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

  myProfile = {
    id: `user_${Date.now()}_${Math.floor(Math.random()*1000)}`,
    name,
    faculty,
    bio,
    img: photoUrl
  };

  saveAppState();
  updateProfileUI();
  syncProfileToServer();

  if (socket) {
    socket.emit('register_socket_user', myProfile.id);
  }

  document.getElementById('register-modal').classList.remove('open');
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
