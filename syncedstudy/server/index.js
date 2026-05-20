const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// Basic health check
app.get("/", (req, res) => {
  res.json({ status: "SyncedStudy server is running" });
});

// In-memory room store (will move to Redis later)
const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join_room", ({ roomCode, displayName, task }) => {
    socket.join(roomCode);

    if (!rooms[roomCode]) rooms[roomCode] = { users: {} };
    rooms[roomCode].users[socket.id] = { displayName, task };

    io.to(roomCode).emit("room_update", rooms[roomCode].users);
    console.log(`${displayName} joined room ${roomCode}`);
  });

  socket.on("disconnect", () => {
    // Remove user from their room on disconnect
    for (const roomCode in rooms) {
      if (rooms[roomCode].users[socket.id]) {
        delete rooms[roomCode].users[socket.id];
        io.to(roomCode).emit("room_update", rooms[roomCode].users);
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
