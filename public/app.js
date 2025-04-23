function startChat() {
  window.location.href = "chat.html";
}

let socket;
let typingTimer;
let searchTimeout;

window.onload = () => {
  if (window.location.pathname.includes("chat.html")) {
    socket = io();
    const statusBadge = document.getElementById("status-badge");
    const statusMessage = document.getElementById("status-message");
    const chatBox = document.getElementById("chatBox");
    const typingIndicator = document.getElementById("typing-indicator");

    // Set initial searching state
    setSearchingState();
    
    // Start search timeout
    startSearchTimeout();

    socket.on("status", (status) => {
      clearTimeout(searchTimeout); // Clear timeout

      switch(status) {
        case "searching":
          setSearchingState();
          startSearchTimeout();
          break;

        case "connected":
          statusBadge.className = "text-sm px-3 py-1 rounded-full bg-green-100 text-green-800";
          statusBadge.textContent = "Connected";
          statusMessage.style.display = "none";
          statusMessage.innerHTML = "";
          chatBox.innerHTML = '<div id="typing-indicator" class="typing-indicator" style="display: none;">Stranger is typing...</div>';
          break;

        case "error":
          setErrorState();
          break;
      }
    });

    socket.on("message", (msg) => {
      chatBox.insertAdjacentHTML('beforeend', 
        `<div class="chat-bubble-stranger">${msg}</div>`);
      chatBox.scrollTop = chatBox.scrollHeight;
      hideTypingIndicator();
    });

    socket.on("typing", () => {
      showTypingIndicator();
    });

    socket.on("stop-typing", () => {
      hideTypingIndicator();
    });

    socket.on("connect_error", () => {
      setErrorState("Connection failed. Please check your internet connection.");
    });

    socket.on("disconnect", () => {
      setErrorState("Disconnected from server. Trying to reconnect...");
    });

    // UI state functions
    function setSearchingState() {
      statusBadge.className = "text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 pulse";
      statusBadge.textContent = "Searching...";
      statusMessage.style.display = "block";
      statusMessage.textContent = "Looking for someone to chat with";
      statusMessage.className = "status-indicator connecting-animation";
    }

    function setErrorState(message = "No users available. Please try again later.") {
      statusBadge.className = "text-sm px-3 py-1 rounded-full bg-red-100 text-red-800";
      statusBadge.textContent = "Not Connected";
      statusMessage.style.display = "block";
      statusMessage.textContent = message;
      statusMessage.className = "status-indicator text-red-600";
    }

    function startSearchTimeout() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        setErrorState();
        statusMessage.innerHTML += `
          <div class="mt-4">
            <button onclick="retryConnection()" 
              class="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm hover:bg-indigo-700 btn">
              Try Again
            </button>
          </div>`;
      }, 15000);
    }

    function showTypingIndicator() {
      if (typingIndicator) {
        typingIndicator.style.display = "block";
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }

    function hideTypingIndicator() {
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
    if (socket) {
      socket.emit("stop-typing");
    }
  }, 1000);
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value;
  if (!msg.trim() || !socket) return;

  const chatBox = document.getElementById("chatBox");
  chatBox.insertAdjacentHTML('beforeend', 
    `<div class="chat-bubble-you">${msg}</div>`);
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

  statusBadge.className = "text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 pulse";
  statusBadge.textContent = "Searching...";
  statusMessage.style.display = "block";
  statusMessage.textContent = "Looking for someone new to chat with";
  statusMessage.className = "status-indicator connecting-animation";

  document.getElementById("chatBox").innerHTML = 
    '<div id="typing-indicator" class="typing-indicator" style="display: none;">Stranger is typing...</div>';

  startSearchTimeout();
}

function revealIdentity() {
  if (!socket) return;

  socket.emit("reveal");

  const chatBox = document.getElementById("chatBox");
  chatBox.insertAdjacentHTML('beforeend', 
    `<div class="chat-bubble-you text-yellow-600"><i>You chose to reveal your identity</i></div>`);
}

function retryConnection() {
  if (!socket) return;

  socket.connect(); // only needed if you've disconnected it manually

  const statusBadge = document.getElementById("status-badge");
  const statusMessage = document.getElementById("status-message");

  statusBadge.className = "text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 pulse";
  statusBadge.textContent = "Searching...";
  statusMessage.style.display = "block";
  statusMessage.textContent = "Looking for someone to chat with";
  statusMessage.className = "status-indicator connecting-animation";

  startSearchTimeout();
}
