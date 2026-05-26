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
const MAX_ROOMS = 30;
const messageCooldowns = {}; // socketId -> last message timestamp

const DEFAULT_SESSION_TIMES = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
};

io.on("connection", (socket) => {
  socket.on("join_room", ({ roomCode, displayName, task, isHost }) => {
    // If joining (not creating), the room must already exist
    if (!isHost && !rooms[roomCode]) {
      socket.emit("join_error", { message: "Room not found. Check the code and try again." });
      return;
    }

    // If creating, check server capacity
    if (isHost && !rooms[roomCode] && Object.keys(rooms).length >= MAX_ROOMS) {
      socket.emit("join_error", { message: "The server is full right now. Try again later." });
      return;
    }

    socket.join(roomCode);

    if (!rooms[roomCode]) {
      // Only the host can create a new room
      rooms[roomCode] = {
        users: {},
        hostSocketId: socket.id,
        state: 'idle',
        sessionType: 'work',
        settings: { ...DEFAULT_SESSION_TIMES },
        timeLeft: DEFAULT_SESSION_TIMES.work,
        pomodoroCount: 0,
        chatMessages: [],
        taskHistory: []
      };
    }

    rooms[roomCode].users[socket.id] = { displayName, task, totalFocusTime: 0 };

    if (task) {
      rooms[roomCode].taskHistory.push({ displayName, task, timestamp: Date.now() });
    }

    io.to(roomCode).emit("room_sync", rooms[roomCode]);
  });

  socket.on("update_task", ({ roomCode, task }) => {
    if (rooms[roomCode] && rooms[roomCode].users[socket.id]) {
      const user = rooms[roomCode].users[socket.id];
      user.task = task;
      if (task) {
        rooms[roomCode].taskHistory.push({ displayName: user.displayName, task, timestamp: Date.now() });
      }
      io.to(roomCode).emit("room_sync", rooms[roomCode]);
    }
  });

  socket.on("send_message", ({ roomCode, text }) => {
    if (rooms[roomCode] && rooms[roomCode].users[socket.id]) {
      const now = Date.now();
      const lastSent = messageCooldowns[socket.id] || 0;
      if (now - lastSent < 1000) return; // silently drop if under 1 second
      messageCooldowns[socket.id] = now;

      const user = rooms[roomCode].users[socket.id];
      const message = { id: now, sender: user.displayName, text, timestamp: now };
      rooms[roomCode].chatMessages.push(message);
      if (rooms[roomCode].chatMessages.length > 50) rooms[roomCode].chatMessages.shift();
      io.to(roomCode).emit("room_sync", rooms[roomCode]);
    }
  });

  socket.on("update_settings", ({ roomCode, settings }) => {
    const room = rooms[roomCode];
    if (room && room.hostSocketId === socket.id) {
      room.settings = { ...room.settings, ...settings };
      // If timer is idle, update timeLeft to reflect new settings
      if (room.state === 'idle') {
        room.timeLeft = room.settings[room.sessionType];
      }
      io.to(roomCode).emit("room_sync", room);
    }
  });

  socket.on("timer_control", ({ roomCode, action }) => { // action: start, pause, reset
    const room = rooms[roomCode];
    if (room && room.hostSocketId === socket.id) {
      if (action === 'start') {
        room.state = 'running';
      } else if (action === 'pause') {
        room.state = 'paused';
      } else if (action === 'reset') {
        room.state = 'idle';
        room.timeLeft = room.settings[room.sessionType];
      }
      io.to(roomCode).emit("room_sync", room);
    }
  });

  socket.on("start_break", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.hostSocketId === socket.id && room.state === 'pomodoroComplete') {
      room.sessionType = room.nextSessionType;
      room.timeLeft = room.settings[room.nextSessionType];
      room.state = 'idle';
      delete room.nextSessionType;
      io.to(roomCode).emit("room_sync", room);
    }
  });

  socket.on("end_session", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.hostSocketId === socket.id) {
      room.state = 'ended';
      io.to(roomCode).emit("room_sync", room);
    }
  });

  socket.on("disconnect", () => {
    delete messageCooldowns[socket.id];
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.users[socket.id]) {
        const wasHost = room.hostSocketId === socket.id;
        delete room.users[socket.id];
        
        const remainingUsers = Object.keys(room.users);
        if (remainingUsers.length === 0) {
          delete rooms[roomCode]; // Clean up empty room
        } else {
          if (wasHost) {
             room.hostSocketId = remainingUsers[0]; // Assign new host
          }
          io.to(roomCode).emit("room_sync", room);
        }
      }
    }
  });
});

// Server tick loop for timers
setInterval(() => {
  for (const roomCode in rooms) {
    const room = rooms[roomCode];
    if (room.state === 'running') {
      room.timeLeft -= 1;
      
      // Add to focus time if working
      if (room.sessionType === 'work') {
        for (const userId in room.users) {
          room.users[userId].totalFocusTime += 1;
        }
      }

      if (room.timeLeft <= 0) {
        if (room.sessionType === 'work') {
          room.pomodoroCount += 1;
          // Pause in pomodoroComplete state so a summary can be shown
          room.state = 'pomodoroComplete';
          room.nextSessionType = room.pomodoroCount % 4 === 0 ? 'longBreak' : 'shortBreak';
          room.timeLeft = 0;
        } else {
          // Break ended, back to work
          room.state = 'idle';
          room.sessionType = 'work';
          room.timeLeft = room.settings.work;
        }
        io.to(roomCode).emit("session_ended", { newSessionType: room.sessionType });
      }
      io.to(roomCode).emit("room_sync", room);
    }
  }
}, 1000);

server.listen(4000, () => console.log("Server running on port 4000"));
