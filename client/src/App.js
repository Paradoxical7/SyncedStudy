import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
const socket = io("http://localhost:4000");
export default function App() {
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [task, setTask] = useState("");
  const [joined, setJoined] = useState(false);
  const [users, setUsers] = useState({});
  useEffect(() => {
    socket.on("room_update", setUsers);
    return () => socket.off("room_update");
  }, []);
  const joinRoom = () => {
    if (!roomCode || !displayName) return;
    socket.emit("join_room", { roomCode, displayName, task });
    setJoined(true);
  };
  if (!joined) return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>?? SyncedStudy</h1>
      <input placeholder="Room code" value={roomCode} onChange={e => setRoomCode(e.target.value)} /><br/>
      <input placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} /><br/>
      <input placeholder="What are you working on?" value={task} onChange={e => setTask(e.target.value)} /><br/>
      <button onClick={joinRoom}>Join Room</button>
    </div>
  );
  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>?? SyncedStudy — Room: {roomCode}</h1>
      <ul>{Object.values(users).map((u, i) => <li key={i}><b>{u.displayName}</b>{u.task ? ` — ${u.task}` : ""}</li>)}</ul>
      <p style={{color:"#888"}}>Timer coming soon...</p>
    </div>
  );
}
