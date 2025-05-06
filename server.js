const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Users data (in-memory)
let users = {}; // username => { password, instagram }
let waiting = [];
let partners = new Map(); // socket.id => partner.id

// Session middleware
const sessionMiddleware = session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
});

app.use(express.static("public")); // Serve frontend
app.use(bodyParser.json());
app.use(sessionMiddleware);

// Share session with Socket.IO
const wrap = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// =======================
// Auth Routes
// =======================

app.post("/signup", (req, res) => {
  const { username, password, instagram } = req.body;
  if (users[username]) {
    return res.status(400).send("User already exists");
  }
  users[username] = { password, instagram };
  req.session.username = username;
  res.status(200).send("Signup successful");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || user.password !== password) {
    return res.status(401).send("Invalid credentials");
  }
  req.session.username = username;
  res.status(200).send("Login successful");
});

app.get("/profile", (req, res) => {
  const username = req.session.username;
  const user = users[username];
  if (!username || !user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  res.json({ username, instagram: user.instagram });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(200).send("Logged out");
  });
});

// =======================
// Socket.IO logic
// =======================

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  // Emit current online users count to all clients
  io.emit("onlineUsers", io.engine.clientsCount);

  socket.emit("status", "searching");

  // Try pairing
  if (waiting.length > 0) {
    const partner = waiting.pop();

    if (io.sockets.sockets.has(partner.id)) {
      partners.set(socket.id, partner.id);
      partners.set(partner.id, socket.id);

      socket.emit("status", "connected");
      partner.emit("status", "connected");

      socket.emit("message", "You are now connected!");
      partner.emit("message", "You are now connected!");
    } else {
      waiting = waiting.filter(s => s.id !== partner.id);
      waiting.push(socket);
    }
  } else {
    waiting.push(socket);
  }

  socket.on("message", (msg) => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("message", msg);
    }
  });

  socket.on("typing", () => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("typing");
    }
  });

  socket.on("stop-typing", () => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("stop-typing");
    }
  });

  socket.on("next", () => {
    disconnectPartner(socket);
    socket.emit("status", "searching");
    if (!waiting.includes(socket)) waiting.push(socket);
  });

  socket.on("reveal", () => {
    const partnerId = partners.get(socket.id);
    const username = socket.request.session?.username;
    const user = users[username];

    if (partnerId) {
      if (user?.instagram) {
        io.to(partnerId).emit("message", `[Your partner's Instagram: ${user.instagram}]`);
      } else {
        io.to(partnerId).emit("message", "[Your partner wants to reveal identity]");
      }
    }
  });

  socket.on("disconnect", () => {
    disconnectPartner(socket);
    waiting = waiting.filter(s => s.id !== socket.id);
    console.log("User disconnected:", socket.id);
    // Emit updated count when user disconnects
    io.emit("onlineUsers", io.engine.clientsCount);
  });
});

// =======================
// Helper Function
// =======================

function disconnectPartner(socket) {
  const partnerId = partners.get(socket.id);
  if (partnerId) {
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.emit("message", "Stranger has left.");
      partnerSocket.emit("status", "searching");
      if (!waiting.includes(partnerSocket)) waiting.push(partnerSocket);
    }
    partners.delete(partnerId);
    partners.delete(socket.id);
  }
}

// =======================
// Start Server
// =======================

server.listen(8000, () => {
  console.log("🚀 Server running at http://localhost:8000");
});
