import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Frontend-in işlədiyi port (məsələn, Vite 5173 və ya preview)
    methods: ["GET", "POST"]
  }
});

// Gözləmə növbəsi (Queue) və aktiv otaqlar
const waitingQueue = [];
const activeRooms = new Map(); // socket.id -> chatId

io.on("connection", (socket) => {
  console.log(`İstifadəçi qoşuldu: ${socket.id}`);

  // Axtarışa başlamaq
  socket.on("search:start", (userData) => {
    console.log(`Axtarış başladı: ${socket.id}`, userData);
    
    // İstifadəçini növbəyə əlavə edək
    waitingQueue.log = waitingQueue.push({ socket, userData });

    tryMatchmaking();
  });

  // Axtarışı dayandırmaq
  socket.on("search:stop", () => {
    removeFromQueue(socket);
  });

  // Mesaj göndərmək
  nodeSocketMessage(socket);

  // Əlaqə kəsildikdə
  socket.on("disconnect", () => {
    console.log(`İstifadəçi ayrıldı: ${socket.id}`);
    removeFromQueue(socket);
    handleChatDisconnect(socket);
  });
});

// Matchmaking (Cütləşdirmə) məntiqi
function tryMatchmaking() {
  if (waitingQueue.length >= 2) {
    const user1 = waitingQueue.shift();
    const user2 = waitingQueue.shift();

    const chatId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    user1.socket.join(chatId);
    user2.socket.join(chatId);

    activeRooms.set(user1.socket.id, chatId);
    activeRooms.set(user2.socket.id, chatId);

    // Hər iki tərəfə matçın tapıldığını xəbər verək
    user1.socket.emit("match:found", { chatId, strangerId: user2.socket.id });
    user2.socket.emit("match:found", { chatId, strangerId: user1.socket.id });

    console.log(`Otaq yaradıldı: ${chatId}`);
  }
}

function removeFromQueue(socket) {
  const index = waitingQueue.findIndex(item => item.socket.id === socket.id);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
  }
}

function nodeSocketMessage(socket) {
  socket.on("message:send", ({ chatId, text }) => {
    socket.to(chatId).emit("message:receive", {
      text,
      sender: "other",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });
}

function handleChatDisconnect(socket) {
  const chatId = activeRooms.get(socket.id);
  if (chatId) {
    socket.to(chatId).emit("chat:disconnected");
    activeRooms.delete(socket.id);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Backend server işləyir: http://localhost:${PORT}`);
});