// Define global variables
let socket;
let typingTimer;
let searchTimeout;
let isLoggedIn = false;
let userProfile = null;

// Check login status
async function checkLoginStatus() {
  try {
    const response = await fetch('/profile', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      isLoggedIn = true;
      userProfile = data;
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error checking login status:', error);
    return null;
  }
}

// Redirect to chat page
function startChat() {
  window.location.href = "chat.html";
}

window.onload = async () => {
  const userProfile = await checkLoginStatus();

  if (window.location.pathname.includes("index.html") || window.location.pathname === "/") {
    socket = io();

    const onlineUsersElement = document.getElementById("online-users");
    socket.on("onlineUsers", (count) => {
      if (onlineUsersElement) onlineUsersElement.textContent = `Users Online: ${count}`;
    });
  }

  if (window.location.pathname.includes("chat.html")) {
    socket = io();

    const onlineUsersElement = document.getElementById("online-users");
    const chatBox = document.getElementById("chatBox");

    socket.on("onlineUsers", (count) => {
      if (onlineUsersElement) onlineUsersElement.textContent = `Users Online: ${count}`;
    });

    // Create hidden typing indicator once
    if (chatBox && !document.getElementById("typing-indicator")) {
      chatBox.insertAdjacentHTML('beforeend', `<div id="typing-indicator" class="typing-indicator" style="display: none;">Stranger is typing...</div>`);
    }

    const typingIndicator = document.getElementById("typing-indicator");

    setSearchingState();
    startSearchTimeout();

    socket.on("status", (status) => {
      clearTimeout(searchTimeout);
      switch (status) {
        case "searching":
          setSearchingState();
          startSearchTimeout();
          break;
        case "connected":
          const statusBadge = document.getElementById("status-badge");
          const statusMessage = document.getElementById("status-message");

          if (statusBadge) {
            statusBadge.className = "text-sm px-3 py-1 rounded-full bg-green-100 text-green-800";
            statusBadge.textContent = "Connected";
          }
          if (statusMessage) {
            statusMessage.style.display = "none";
            statusMessage.innerHTML = "";
          }

          // Clear chat and re-append typing indicator (hidden)
          if (chatBox) {
            chatBox.innerHTML = '';
            chatBox.insertAdjacentHTML('beforeend', `<div id="typing-indicator" class="typing-indicator" style="display: none;">Stranger is typing...</div>`);
          }
          break;
        case "error":
          setErrorState();
          break;
      }
    });

    socket.on("message", (msg) => {
      if (chatBox) {
        chatBox.insertAdjacentHTML('beforeend', `<div class="chat-bubble-stranger">${msg}</div>`);
        chatBox.scrollTop = chatBox.scrollHeight;
      }
      hideTypingIndicator();
    });

    socket.on("typing", () => showTypingIndicator());
    socket.on("stop-typing", () => hideTypingIndicator());

    socket.on("connect_error", () => {
      setErrorState("Connection failed. Please check your internet connection.");
    });

    socket.on("disconnect", () => {
      setErrorState("Disconnected from server. Trying to reconnect...");
    });

    function setSearchingState() {
      const statusBadge = document.getElementById("status-badge");
      const statusMessage = document.getElementById("status-message");

      if (statusBadge) {
        statusBadge.className = "text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 pulse";
        statusBadge.textContent = "Searching...";
      }

      if (statusMessage) {
        statusMessage.style.display = "block";
        statusMessage.textContent = "Looking for someone to chat with";
        statusMessage.className = "status-indicator connecting-animation";
      }
    }

    function setErrorState(message = "No users available. Please try again later.") {
      const statusBadge = document.getElementById("status-badge");
      const statusMessage = document.getElementById("status-message");

      if (statusBadge) {
        statusBadge.className = "text-sm px-3 py-1 rounded-full bg-red-100 text-red-800";
        statusBadge.textContent = "Not Connected";
      }

      if (statusMessage) {
        statusMessage.style.display = "block";
        statusMessage.textContent = message;
        statusMessage.className = "status-indicator text-red-600";
      }
    }

    function startSearchTimeout() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        setErrorState();
        const statusMessage = document.getElementById("status-message");
        if (statusMessage) {
          statusMessage.innerHTML += `
            <div class="mt-4">
              <button onclick="retryConnection()" 
                class="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm hover:bg-indigo-700 btn">
                Try Again
              </button>
            </div>`;
        }
      }, 15000);
    }

    function showTypingIndicator() {
      const typingIndicator = document.getElementById("typing-indicator");
      if (typingIndicator) {
        typingIndicator.style.display = "block";
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }

    function hideTypingIndicator() {
      const typingIndicator = document.getElementById("typing-indicator");
      if (typingIndicator) {
        typingIndicator.style.display = "none";
      }
    }
  }
};

function handleKeyPress(event) {
  if (event.key === "Enter") {
    sendMessage();
    return;
  }

  if (!socket) return;
  socket.emit("typing");

  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    if (socket) socket.emit("stop-typing");
  }, 1000);
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value;
  if (!msg.trim() || !socket) return;

  const chatBox = document.getElementById("chatBox");
  chatBox.insertAdjacentHTML('beforeend', `<div class="chat-bubble-you">${msg}</div>`);
  socket.emit("message", msg);
  input.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;
  socket.emit("stop-typing");
}

function nextChat() {
  if (!socket) return;
  socket.emit("next");

  const statusBadge = document.getElementById("status-badge");
  const statusMessage = document.getElementById("status-message");

  if (statusBadge) {
    statusBadge.className = "text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 pulse";
    statusBadge.textContent = "Searching...";
  }

  if (statusMessage) {
    statusMessage.style.display = "block";
    statusMessage.textContent = "Looking for someone new to chat with";
    statusMessage.className = "status-indicator connecting-animation";
  }

  const chatBox = document.getElementById("chatBox");
  if (chatBox) {
    chatBox.innerHTML = `<div id="typing-indicator" class="typing-indicator" style="display: none;">Stranger is typing...</div>`;
  }

  startSearchTimeout();
}

function retryConnection() {
  if (!socket) return;
  socket.connect();

  const statusBadge = document.getElementById("status-badge");
  const statusMessage = document.getElementById("status-message");

  if (statusBadge) {
    statusBadge.className = "text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 pulse";
    statusBadge.textContent = "Searching...";
  }

  if (statusMessage) {
    statusMessage.style.display = "block";
    statusMessage.textContent = "Looking for someone to chat with";
    statusMessage.className = "status-indicator connecting-animation";
  }

  startSearchTimeout();
}

function revealIdentity() {
  if (!socket) return;

  const chatBox = document.getElementById("chatBox");

  if (isLoggedIn && userProfile && userProfile.instagram) {
    socket.emit("reveal", userProfile.instagram);
    chatBox.insertAdjacentHTML('beforeend',
      `<div class="chat-bubble-you text-yellow-600"><i>You shared your Instagram: @${userProfile.instagram}</i></div>`);
  } else if (isLoggedIn) {
    alert("Please set your Instagram username in your profile first.");
  } else {
    socket.emit("reveal");
    chatBox.insertAdjacentHTML('beforeend',
      `<div class="chat-bubble-you text-yellow-600"><i>You chose to reveal your identity</i></div>`);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.includes("chat.html") || window.location.pathname.includes("profile.html")) {
    await checkLoginStatus();
  }

  if (isLoggedIn) {
    document.querySelectorAll('.profile-only').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'none');
  } else {
    document.querySelectorAll('.profile-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'block');
  }
});

function logout() {
  fetch('/logout', {
    method: 'POST'
  }).then(() => {
    isLoggedIn = false;
    userProfile = null;
    window.location.href = 'index.html';
  }).catch(error => {
    console.error('Error during logout:', error);
  });
}
