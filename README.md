# Multiplayer Tic-Tac-Toe

Real-time Tic-Tac-Toe with Socket.io. Join a room, see the board update instantly, and play until someone wins or it’s a draw.

## Tech stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Real-time:** Socket.io

## Run the app

```bash
npm install
npm start
```

Open **http://localhost:3000** in two browser windows (or tabs). Enter a name and the same room code (e.g. `room1`) in both, then click **Join room**. Moves and turn updates sync in real time.

## Features

- Join a game by room code
- Live board updates for both players
- Clear indication of whose turn it is
- Winner and draw detection
- Play again after a game ends
- Leave room and rejoin with a new code
