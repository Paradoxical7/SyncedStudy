const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "http://localhost:3000" } });
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => res.json({ status: "SyncedStudy server is running" }));
const rooms = {};
io.on("connection", (socket) => {
  socket.on("join_room", ({ roomCode, displayName, task }) => {
    socket.join(roomCode);
    if (!rooms[roomCode]) rooms[roomCode] = { users: {} };
    rooms[roomCode].users[socket.id] = { displayName, task };
    io.to(roomCode).emit("room_update", rooms[roomCode].users);
  });
  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      if (rooms[roomCode].users[socket.id]) {
        delete rooms[roomCode].users[socket.id];
        io.to(roomCode).emit("room_update", rooms[roomCode].users);
      }
    }
  });
});
server.listen(4000, () => console.log("Server running on port 4000"));
