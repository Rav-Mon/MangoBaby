const socket = io();
const peer = new Peer();
const usernameInput = document.getElementById('username');
const loginBtn = document.getElementById('login-btn');
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messages = document.getElementById('messages');
const profilePic = document.getElementById('profile-pic');
const partnerPic = document.getElementById('partner-pic');
const partnerName = document.getElementById('partner-name');
const partnerStatus = document.getElementById('partner-status');
const callBtn = document.getElementById('call-btn');
const videoCallScreen = document.getElementById('video-call-screen');
const myVideo = document.getElementById('my-video');
const partnerVideo = document.getElementById('partner-video');
const endCallBtn = document.getElementById('end-call');
const callTimer = document.getElementById('call-timer');

let currentUser = '';
let partner = '';
let stream = null;
let callTimerInterval = null;

// Initialize UI
videoCallScreen.classList.add('hidden'); // Ensure video call screen is hidden
chatScreen.classList.add('hidden'); // Ensure chat screen is hidden
loginScreen.classList.remove('hidden'); // Ensure login screen is visible
profilePic.src = '/ravmon.jpg'; // Fixed profile picture
callTimer.textContent = '00:00'; // Reset timer

loginBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim().toLowerCase();
  if (username === 'rav' || username === 'mon') {
    currentUser = username;
    socket.emit('login', username);
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
  } else {
    alert('Please enter "Rav" or "Mon"');
  }
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (text) {
    const id = Date.now().toString();
    socket.emit('message', { id, text, user: currentUser });
    addMessage({ id, text, user: currentUser }, true);
    messageInput.value = '';
  }
}

function addMessage(data, isOwnMessage) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwnMessage ? 'own-message' : 'partner-message'}`;
  messageDiv.dataset.id = data.id;
  messageDiv.innerHTML = `
    <span>${data.text}</span>
    ${isOwnMessage ? '<i class="fas fa-trash delete-icon" onclick="deleteMessage(\'' + data.id + '\')"></i>' : ''}
  `;
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}

window.deleteMessage = function(id) {
  socket.emit('delete-message', id);
};

socket.on('message', (data) => {
  if (data.user !== currentUser) {
    addMessage(data, false);
  }
});

socket.on('delete-message', (id) => {
  const message = document.querySelector(`.message[data-id="${id}"]`);
  if (message) message.remove();
});

socket.on('user-connected', (user) => {
  if (user !== currentUser) {
    partner = user;
    partnerName.textContent = partner.charAt(0).toUpperCase() + partner.slice(1);
    partnerStatus.textContent = 'Online';
    partnerStatus.classList.remove('offline');
    partnerStatus.classList.add('online');
    partnerPic.src = '/rav-mon-profile.png';
  }
});

socket.on('user-disconnected', (user) => {
  if (user === partner) {
    partnerStatus.textContent = 'Offline';
    partnerStatus.classList.remove('online');
    partnerStatus.classList.add('offline');
  }
});

callBtn.addEventListener('click', () => {
  if (partner && partnerStatus.textContent === 'Online') {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((userStream) => {
      stream = userStream;
      myVideo.srcObject = stream;
      const call = peer.call(partner, stream);
      socket.emit('call', { from: currentUser, to: partner });
      videoCallScreen.classList.remove('hidden');
      chatScreen.classList.add('hidden');
      startCallTimer();
      call.on('stream', (remoteStream) => {
        partnerVideo.srcObject = remoteStream;
      });
    }).catch((err) => {
      console.error('Failed to get media:', err);
      alert('Unable to access camera/microphone');
    });
  } else {
    alert('Partner is offline');
  }
});

socket.on('call', (data) => {
  if (data.to === currentUser) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((userStream) => {
      stream = userStream;
      myVideo.srcObject = stream;
      videoCallScreen.classList.remove('hidden');
      chatScreen.classList.add('hidden');
      startCallTimer();
      peer.on('call', (call) => {
        call.answer(stream);
        call.on('stream', (remoteStream) => {
          partnerVideo.srcObject = remoteStream;
        });
      });
      socket.emit('call-accepted', { from: currentUser, to: data.from });
    }).catch((err) => {
      console.error('Failed to get media:', err);
      socket.emit('call-rejected', { from: currentUser, to: data.from });
    });
  }
});

socket.on('call-accepted', (data) => {
  if (data.to === currentUser) {
    // Call already handled
  }
});

socket.on('call-rejected', (data) => {
  if (data.to === currentUser) {
    alert('Call rejected by partner');
    endCall();
  }
});

endCallBtn.addEventListener('click', endCall);

socket.on('call-ended', (data) => {
  if (data.to === currentUser) {
    endCall();
  }
});

function endCall() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  videoCallScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  myVideo.srcObject = null;
  partnerVideo.srcObject = null;
  socket.emit('call-ended', { from: currentUser, to: partner });
  stopCallTimer();
}

function startCallTimer() {
  let seconds = 0;
  callTimerInterval = setInterval(() => {
    seconds++;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    callTimer.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
    callTimer.textContent = '00:00';
  }
}

document.getElementById('my-video-fullscreen').addEventListener('click', () => {
  const video = document.getElementById('my-video');
  if (video.requestFullscreen) {
    video.requestFullscreen();
  }
});

document.getElementById('partner-video-fullscreen').addEventListener('click', () => {
  const video = document.getElementById('partner-video');
  if (video.requestFullscreen) {
    video.requestFullscreen();
  }
});

peer.on('open', (id) => {
  socket.emit('peer-id', { user: currentUser, id });
});
