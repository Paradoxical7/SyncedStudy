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

const DEFAULT_SESSION_TIMES = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
};

io.on("connection", (socket) => {
  socket.on("join_room", ({ roomCode, displayName, task }) => {
    socket.join(roomCode);
    
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        users: {},
        hostSocketId: socket.id,
        state: 'idle', // idle, running, paused
        sessionType: 'work', // work, shortBreak, longBreak
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
      const user = rooms[roomCode].users[socket.id];
      const message = { id: Date.now(), sender: user.displayName, text, timestamp: Date.now() };
      rooms[roomCode].chatMessages.push(message);
      // keep only last 50 messages
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

  socket.on("disconnect", () => {
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
        room.state = 'idle';
        if (room.sessionType === 'work') {
          room.pomodoroCount += 1;
          if (room.pomodoroCount % 4 === 0) {
            room.sessionType = 'longBreak';
            room.timeLeft = room.settings.longBreak;
          } else {
            room.sessionType = 'shortBreak';
            room.timeLeft = room.settings.shortBreak;
          }
        } else {
          // Break ended, back to work
          room.sessionType = 'work';
          room.timeLeft = room.settings.work;
        }
        // Emit an event specifically for session end (for audio alerts on client)
        io.to(roomCode).emit("session_ended", { newSessionType: room.sessionType });
      }
      io.to(roomCode).emit("room_sync", room);
    }
  }
}, 1000);

server.listen(4000, () => console.log("Server running on port 4000"));
