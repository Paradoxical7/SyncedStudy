import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Play, Pause, RotateCcw, Send, Users, MessageSquare, Clock, User, CheckCircle2, Settings, History, X } from "lucide-react";

const socket = io(process.env.REACT_APP_SERVER_URL || "http://localhost:4000");

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
  const [mode, setMode] = useState(null); // null | 'join' | 'create'
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [task, setTask] = useState("");

  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [room, setRoom] = useState(null);
  const [chatInput, setChatInput] = useState("");
  
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ work: 25, shortBreak: 5, longBreak: 15 });

  const chatEndRef = useRef(null);

  const prevStateRef = useRef(null);
  const pendingJoinRef = useRef(false);

  useEffect(() => {
    socket.on("room_sync", (data) => {
      // If a guest was waiting for confirmation, admit them now
      if (pendingJoinRef.current) {
        pendingJoinRef.current = false;
        setJoined(true);
      }
      // Play chime when a work session just completed
      if (prevStateRef.current !== 'pomodoroComplete' && data.state === 'pomodoroComplete') {
        playChime();
      }
      prevStateRef.current = data.state;
      setRoom(data);
      if (data.settings) {
        setSettingsForm({
          work: Math.round(data.settings.work / 60),
          shortBreak: Math.round(data.settings.shortBreak / 60),
          longBreak: Math.round(data.settings.longBreak / 60)
        });
      }
    });

    socket.on("join_error", ({ message }) => {
      setJoinError(message);
    });

    socket.on("session_ended", ({ newSessionType }) => {
      // chime is now handled via room_sync state detection above
    });

    return () => {
      socket.off("room_sync");
      socket.off("join_error");
      socket.off("session_ended");
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [room?.chatMessages]);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars like 0/O, 1/I
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const openNewLobby = () => {
    setRoomCode(generateRoomCode());
    setMode('create');
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomCode || !displayName) return;
    setJoinError("");
    socket.emit("join_room", { roomCode, displayName, task, isHost: mode === 'create' });
    if (mode === 'create') {
      setJoined(true); // host always gets in immediately
    } else {
      pendingJoinRef.current = true; // guest waits for server confirmation
    }
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
    // ── Landing: pick a mode ──────────────────────────────────────────
    if (!mode) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2rem' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '520px' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h1 style={{ color: 'var(--accent-work)', fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '0.5rem' }}>
                <Clock size={36} /> SyncedStudy
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>Focus together, in sync.</p>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem' }}>
              {/* Join card */}
              <button
                onClick={() => { setRoomCode(''); setMode('join'); }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '2rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  transition: 'all 0.2s ease',
                  color: 'inherit',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent-work)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>🔑</div>
                <div>
                  <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Join a Session</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Have a room code? Enter it to jump into an existing study lobby.
                  </p>
                </div>
              </button>

              {/* Create card */}
              <button
                onClick={openNewLobby}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '2rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  transition: 'all 0.2s ease',
                  color: 'inherit',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent-work)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>🚀</div>
                <div>
                  <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Open New Lobby</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Generate a unique room code and invite friends to study with you.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Create Lobby ──────────────────────────────────────────────────
    if (mode === 'create') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2rem' }}>
          <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
            <button onClick={() => setMode(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1.5rem', padding: 0, fontSize: '0.9rem' }}>
              ← Back
            </button>

            <h2 style={{ margin: '0 0 0.5rem', color: 'var(--accent-work)' }}>Open New Lobby</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Share this code with your friends so they can join.</p>

            {/* Generated code display */}
            <div style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
              borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center'
            }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Room Code</p>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '8px', color: 'var(--accent-work)', margin: '0.5rem 0' }}>
                {roomCode}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  onClick={() => navigator.clipboard.writeText(roomCode)}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  onClick={() => setRoomCode(generateRoomCode())}
                >
                  Regenerate
                </button>
              </div>
            </div>

            <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Your Display Name</label>
                <input required placeholder="Your Name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Current Task (Optional)</label>
                <input placeholder="What are you working on?" value={task} onChange={e => setTask(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>
                Open Lobby
              </button>
            </form>
          </div>
        </div>
      );
    }

    // ── Join Session ──────────────────────────────────────────────────
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2rem' }}>
        <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
          <button onClick={() => setMode(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1.5rem', padding: 0, fontSize: '0.9rem' }}>
            ← Back
          </button>

          <h2 style={{ margin: '0 0 0.5rem', color: 'var(--accent-work)' }}>Join a Session</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Enter the room code shared with you.</p>

          <form onSubmit={joinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Room Code</label>
              <input
                required
                placeholder="e.g. ABC123"
                value={roomCode}
                onChange={e => { setRoomCode(e.target.value.toUpperCase()); setJoinError(""); }}
                style={{
                  letterSpacing: '3px', fontWeight: 700, fontSize: '1.1rem',
                  borderColor: joinError ? 'rgba(255,80,80,0.6)' : undefined
                }}
              />
              {joinError && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠ {joinError}
                </p>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Display Name</label>
              <input required placeholder="Your Name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Current Task (Optional)</label>
              <input placeholder="What are you working on?" value={task} onChange={e => setTask(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>Join Room</button>
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
            {isHost && (
              <button
                onClick={() => socket.emit("end_session", { roomCode })}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255,80,80,0.15)',
                  border: '1px solid rgba(255,80,80,0.4)',
                  borderRadius: '8px',
                  color: '#ff6b6b',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="End Session"
              >
                <X size={16} /> End Session
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

      {/* Pomodoro Complete Mini-Summary Overlay */}
      {room.state === 'pomodoroComplete' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
        }}>
          <div className="glass animate-fade-in" style={{ width: '480px', maxWidth: '90%', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
            <h2 style={{ color: currentAccent, margin: '0 0 0.5rem' }}>
              Pomodoro #{room.pomodoroCount} Complete!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              {room.nextSessionType === 'longBreak'
                ? `Great work — you've earned a ${Math.round(room.settings.longBreak / 60)}-minute long break!`
                : `Nice focus — take a ${Math.round(room.settings.shortBreak / 60)}-minute short break.`}
            </p>

            {/* Per-user focus stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem', textAlign: 'left' }}>
              {Object.entries(room.users).map(([id, u]) => (
                <div key={id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} color="var(--text-secondary)" />
                    <span style={{ fontWeight: 600 }}>{u.displayName}</span>
                    {id === socket.id && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(You)</span>}
                  </div>
                  <div style={{ color: currentAccent, fontWeight: 600 }}>
                    {Math.floor(u.totalFocusTime / 60)}m focused
                  </div>
                </div>
              ))}
            </div>

            {isHost ? (
              <button
                className="btn-primary"
                style={{ width: '100%', backgroundColor: currentAccent, boxShadow: `0 4px 14px ${currentBg}` }}
                onClick={() => socket.emit("start_break", { roomCode })}
              >
                Start {room.nextSessionType === 'longBreak' ? 'Long' : 'Short'} Break
              </button>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Waiting for host to start the break...</p>
            )}
          </div>
        </div>
      )}

      {/* Full Session Summary Overlay */}
      {room.state === 'ended' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70,
          overflowY: 'auto', padding: '2rem'
        }}>
          <div className="glass animate-fade-in" style={{ width: '600px', maxWidth: '95%', padding: '2.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏁</div>
              <h2 style={{ color: currentAccent, margin: '0 0 0.25rem' }}>Session Complete!</h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                {room.pomodoroCount} Pomodoro{room.pomodoroCount !== 1 ? 's' : ''} completed
              </p>
            </div>

            {/* Per-user stats grid */}
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Participants
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
              {Object.entries(room.users).map(([id, u]) => (
                <div key={id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1rem 1.25rem',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  borderLeft: `3px solid ${id === room.hostSocketId ? currentAccent : 'transparent'}`
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <User size={15} color="var(--text-secondary)" />
                      <strong>{u.displayName}</strong>
                      {id === socket.id && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(You)</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '23px' }}>
                      {u.task || 'No task set'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: currentAccent, fontWeight: 700, fontSize: '1.1rem' }}>
                      {Math.floor(u.totalFocusTime / 60)}m
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>focused</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Task history timeline */}
            {room.taskHistory.length > 0 && (
              <>
                <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '1rem' }}>
                  Task History
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {room.taskHistory.map((th, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                      padding: '0.6rem 1rem',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentAccent, marginTop: '7px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, color: currentAccent, marginRight: '8px' }}>{th.displayName}</span>
                        <span>{th.task}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                        {new Date(th.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={() => { setJoined(false); setRoom(null); setRoomCode(''); setDisplayName(''); setTask(''); }}
            >
              Leave Room
            </button>
          </div>
        </div>
      )}

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