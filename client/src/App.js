import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Play, Pause, RotateCcw, Send, Users, MessageSquare, Clock, User, CheckCircle2, Settings, History, X } from "lucide-react";

const socket = io("http://localhost:4000");

const playChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  } catch (e) {
    console.error("Audio chime failed", e);
  }
};

export default function App() {
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [task, setTask] = useState("");
  
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState(null);
  const [chatInput, setChatInput] = useState("");
  
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ work: 25, shortBreak: 5, longBreak: 15 });

  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.on("room_sync", (data) => {
      setRoom(data);
      if (data.settings) {
        setSettingsForm({
          work: Math.round(data.settings.work / 60),
          shortBreak: Math.round(data.settings.shortBreak / 60),
          longBreak: Math.round(data.settings.longBreak / 60)
        });
      }
    });

    socket.on("session_ended", ({ newSessionType }) => {
      playChime();
    });

    return () => {
      socket.off("room_sync");
      socket.off("session_ended");
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [room?.chatMessages]);

  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomCode || !displayName) return;
    socket.emit("join_room", { roomCode, displayName, task });
    setJoined(true);
  };

  const handleUpdateTask = (e) => {
    e.preventDefault();
    socket.emit("update_task", { roomCode, task });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit("send_message", { roomCode, text: chatInput });
    setChatInput("");
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(m).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (!joined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2rem' }}>
        <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ color: 'var(--accent-work)', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Clock size={32} /> SyncedStudy
            </h1>
            <p>Focus together, in sync.</p>
          </div>
          
          <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Room Code</label>
              <input required placeholder="e.g. study123" value={roomCode} onChange={e => setRoomCode(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Display Name</label>
              <input required placeholder="Your Name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Current Task (Optional)</label>
              <input placeholder="What are you working on?" value={task} onChange={e => setTask(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '1rem', width: '100%' }}>Join Room</button>
          </form>
        </div>
      </div>
    );
  }

  if (!room) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Connecting...</div>;

  const isHost = room.hostSocketId === socket.id;
  
  let currentAccent = "var(--accent-work)";
  let currentBg = "var(--accent-work-glow)";
  let sessionLabel = "Focus Session";
  if (room.sessionType === "shortBreak") {
    currentAccent = "var(--accent-shortBreak)";
    currentBg = "var(--accent-shortBreak-glow)";
    sessionLabel = "Short Break";
  } else if (room.sessionType === "longBreak") {
    currentAccent = "var(--accent-longBreak)";
    currentBg = "var(--accent-longBreak-glow)";
    sessionLabel = "Long Break";
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '2rem', gap: '2rem' }}>
      
      {/* Header */}
      <header className="glass" style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Clock color={currentAccent} /> SyncedStudy
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Room</p>
            <strong style={{ fontSize: '1.25rem', letterSpacing: '2px' }}>{roomCode}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Pomodoros</p>
            <strong style={{ fontSize: '1.25rem' }}>{room.pomodoroCount}</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>
            <button className="btn-secondary" style={{ padding: '8px' }} onClick={() => setShowHistory(true)} title="Task History">
              <History size={20} />
            </button>
            {isHost && (
              <button className="btn-secondary" style={{ padding: '8px' }} onClick={() => setShowSettings(true)} title="Settings">
                <Settings size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, gap: '2rem', minHeight: 0 }}>
        
        {/* Left Sidebar: Participants & Tasks */}
        <aside className="glass" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
            <Users size={20} /> Participants ({Object.keys(room.users).length})
          </h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.entries(room.users).map(([id, u]) => (
              <div key={id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: id === room.hostSocketId ? `3px solid ${currentAccent}` : '3px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <User size={16} color="var(--text-secondary)" />
                  <strong style={{ fontSize: '1.1rem' }}>{u.displayName} {id === socket.id && "(You)"}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ marginTop: '3px', flexShrink: 0 }} />
                  <span>{u.task || "No task set"}</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Focus: {Math.floor(u.totalFocusTime / 60)}m
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleUpdateTask} style={{ marginTop: '1.5rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Update your task</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={task} onChange={e => setTask(e.target.value)} placeholder="New task..." style={{ flex: 1 }} />
              <button type="submit" className="btn-secondary" style={{ padding: '0 12px' }}>Set</button>
            </div>
          </form>
        </aside>

        {/* Center: Timer */}
        <main className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          
          <div style={{ 
            width: '350px', height: '350px', 
            borderRadius: '50%', 
            background: `radial-gradient(circle, transparent 40%, ${currentBg} 150%)`,
            border: `2px solid ${currentAccent}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 60px ${currentBg}`,
            transition: 'all 0.5s ease',
            marginBottom: '3rem'
          }}>
            <p style={{ color: currentAccent, fontSize: '1.25rem', fontWeight: 600, letterSpacing: '1px', marginBottom: '0.5rem' }}>
              {sessionLabel.toUpperCase()}
            </p>
            <div style={{ fontSize: '6rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {formatTime(room.timeLeft)}
            </div>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {room.state === 'running' ? 'Timer is running' : 'Timer is paused'}
            </p>
          </div>

          {isHost ? (
            <div style={{ display: 'flex', gap: '1rem' }}>
              {room.state === 'running' ? (
                <button className="btn-secondary" onClick={() => socket.emit("timer_control", { roomCode, action: 'pause' })} style={{ width: '120px' }}>
                  <Pause size={20} /> Pause
                </button>
              ) : (
                <button className="btn-primary" onClick={() => socket.emit("timer_control", { roomCode, action: 'start' })} style={{ width: '120px', backgroundColor: currentAccent, boxShadow: `0 4px 14px ${currentBg}` }}>
                  <Play size={20} fill="currentColor" /> Start
                </button>
              )}
              <button className="btn-secondary" onClick={() => socket.emit("timer_control", { roomCode, action: 'reset' })} style={{ width: '120px' }}>
                <RotateCcw size={20} /> Reset
              </button>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>
              Waiting for host to control timer...
            </div>
          )}

        </main>

        {/* Right Sidebar: Chat */}
        <aside className="glass" style={{ width: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={20} /> Room Chat
            </h3>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {room.chatMessages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: msg.sender === displayName ? currentAccent : 'var(--text-primary)' }}>{msg.sender}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ 
                  background: msg.sender === displayName ? `rgba(255,255,255,0.1)` : 'rgba(0,0,0,0.2)', 
                  padding: '10px 14px', 
                  borderRadius: '12px',
                  borderTopLeftRadius: msg.sender === displayName ? '12px' : '4px',
                  borderTopRightRadius: msg.sender === displayName ? '4px' : '12px',
                  fontSize: '0.95rem'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
            <input 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              placeholder="Type a message..." 
              style={{ flex: 1 }} 
            />
            <button type="submit" className="btn-primary" style={{ padding: '0 16px', background: currentAccent }}>
              <Send size={18} />
            </button>
          </form>
        </aside>

      </div>

      {/* Modals overlay */}
      {(showHistory || showSettings) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          {showHistory && (
            <div className="glass animate-fade-in" style={{ width: '500px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><History /> Session Task History</h3>
                <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => setShowHistory(false)}><X size={18} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {room.taskHistory.map((th, i) => (
                  <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--accent-work)' }}>{th.displayName}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(th.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div>{th.task}</div>
                  </div>
                ))}
                {room.taskHistory.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>No tasks recorded yet.</div>}
              </div>
            </div>
          )}

          {showSettings && (
            <div className="glass animate-fade-in" style={{ width: '400px', maxWidth: '90%', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Settings /> Room Settings</h3>
                <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => setShowSettings(false)}><X size={18} /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                socket.emit("update_settings", {
                  roomCode,
                  settings: {
                    work: settingsForm.work * 60,
                    shortBreak: settingsForm.shortBreak * 60,
                    longBreak: settingsForm.longBreak * 60
                  }
                });
                setShowSettings(false);
              }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Work Session (minutes)</label>
                  <input type="number" min="1" max="120" value={settingsForm.work} onChange={e => setSettingsForm({...settingsForm, work: parseInt(e.target.value) || 25})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Short Break (minutes)</label>
                  <input type="number" min="1" max="30" value={settingsForm.shortBreak} onChange={e => setSettingsForm({...settingsForm, shortBreak: parseInt(e.target.value) || 5})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Long Break (minutes)</label>
                  <input type="number" min="1" max="60" value={settingsForm.longBreak} onChange={e => setSettingsForm({...settingsForm, longBreak: parseInt(e.target.value) || 15})} />
                </div>
                <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Save Changes</button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}