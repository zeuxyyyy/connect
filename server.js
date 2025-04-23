const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // serve frontend

let waiting = [];
let partners = new Map(); // socket.id => partner.id

io.on("connection", (socket) => {
  console.log("New user:", socket.id);

  socket.emit("status", "searching");

  // Try to pair with waiting user
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
      // Partner disconnected
      waiting = waiting.filter(s => s.id !== partner.id);
      socket.emit("status", "searching");
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
    if (partnerId) {
      io.to(partnerId).emit("message", "[Your partner wants to reveal identity]");
    }
  });

  socket.on("disconnect", () => {
    disconnectPartner(socket);
    waiting = waiting.filter(s => s.id !== socket.id);
  });
});

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

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
