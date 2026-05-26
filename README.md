# SyncedStudy 🍅

A Pomodoro-based group study timer that lets everyone stay in sync remotely.

🌐 **Live at: https://synced-study.vercel.app**

## What it does

- Create a lobby with a randomly generated room code or join one with an existing code
- Synced Pomodoro timer (25 min work, 5 min short break, 15 min long break after 4 sessions)
- Live participant list showing everyone's name and current task
- Host controls to start, pause, reset the timer and customize session durations
- Switch tasks mid-session with full task history logged throughout
- Mini summary card after each Pomodoro with per-user focus time
- Full session summary screen when the host ends the session
- Sidebar chat for quick messages during a session
- Max 6 people per room, max 30 active rooms on the server

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React |
| Backend | Node.js + Express |
| Real-time | Socket.io |
| Deployment | Railway (server) + Vercel (client) |

## Project Structure

```
syncedstudy/
├── client/       # React frontend
└── server/       # Node.js + Express backend
```

## Running Locally

### Server
```bash
cd server
npm install
node index.js
```

### Client
```bash
cd client
npm install
npm start
```

## Environment Variables

### Server
```
CLIENT_URL=https://your-client-url.com
```

### Client
```
REACT_APP_SERVER_URL=https://your-server-url.com
```

## Status

✅ v1 Live
