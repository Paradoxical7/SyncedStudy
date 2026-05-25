import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:4000");

export default function App() {
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [task, setTask] = useState("");
  const [joined, setJoined] = useState(false);
  const [users, setUsers] = useState({});
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    socket.on("room_update", setUsers);
    return () => socket.off("room_update");
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft === 0) { setIsRunning(false); return; }
    const tick = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(tick);
  }, [isRunning, timeLeft]);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const joinRoom = () => {
    if (!roomCode || !displayName) return;
    socket.emit("join_room", { roomCode, displayName, task });
    setJoined(true);
  };

  if (!joined) return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>🍅 SyncedStudy</h1>
      <input placeholder="Room code" value={roomCode} onChange={e => setRoomCode(e.target.value)} /><br/>
      <input placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} /><br/>
      <input placeholder="What are you working on?" value={task} onChange={e => setTask(e.target.value)} /><br/>
      <button onClick={joinRoom}>Join Room</button>
    </div>
  );

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>🍅 SyncedStudy — Room: {roomCode}</h1>

      <h2>{formatTime(timeLeft)}</h2>
      <button onClick={() => setIsRunning(r => !r)}>{isRunning ? "Pause" : "Start"}</button>
      <button onClick={() => { setIsRunning(false); setTimeLeft(25 * 60); }}>Reset</button>

      <h3>Who's studying</h3>
      <ul>
        {Object.values(users).map((u, i) => (
          <li key={i}><b>{u.displayName}</b>{u.task ? ` — ${u.task}` : ""}</li>
        ))}
      </ul>
    </div>
  );
}