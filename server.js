const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

function resolvePublicDir() {
  // Render build setups sometimes run the server from a different working directory
  // (e.g. `/opt/render/project/src`), which breaks relative `__dirname/public` paths.
  const candidates = [
    path.join(__dirname, 'public'),
    path.join(__dirname, '..', 'public'),
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'src', 'public'),
  ];

  for (const dir of candidates) {
    try {
      const indexPath = path.join(dir, 'index.html');
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory() && fs.existsSync(indexPath)) {
        return dir;
      }
    } catch {
      // Ignore and try next candidate
    }
  }

  // Fall back to the original location; requests will 500 with a clearer error.
  return path.join(__dirname, 'public');
}

const publicDir = resolvePublicDir();
app.use(express.static(publicDir));
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(500).send(`index.html not found in public dir: ${publicDir}`);
  }
  res.sendFile(indexPath);
});

// Game state: roomId -> { board, turn, players, winner }
const games = new Map();

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function getEmptyBoard() {
  return Array(9).fill(null);
}

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function isDraw(board) {
  return board.every(cell => cell !== null);
}

function createOrJoinRoom(roomId) {
  if (!games.has(roomId)) {
    games.set(roomId, {
      board: getEmptyBoard(),
      turn: 'X',
      players: [],
      winner: null,
      draw: false
    });
  }
  return games.get(roomId);
}

io.on('connection', (socket) => {
  socket.on('join', (roomId, playerName) => {
    const room = createOrJoinRoom(roomId);
    if (room.players.length >= 2) {
      socket.emit('error', 'Room is full');
      return;
    }
    const symbol = room.players.length === 0 ? 'X' : 'O';
    room.players.push({ id: socket.id, name: playerName || `Player ${symbol}`, symbol });
    socket.join(roomId);
    socket.roomId = roomId;
    socket.symbol = symbol;

    io.to(roomId).emit('playerJoined', {
      players: room.players,
      board: room.board,
      turn: room.turn,
      winner: room.winner,
      draw: room.draw
    });
  });

  socket.on('move', (index) => {
    const roomId = socket.roomId;
    if (!roomId || !games.has(roomId)) return;

    const game = games.get(roomId);
    if (game.winner || game.draw) return;
    if (game.board[index] !== null) return;
    if (game.turn !== socket.symbol) return;
    if (game.players.length < 2) return;

    game.board[index] = socket.symbol;
    const winner = checkWinner(game.board);
    const draw = !winner && isDraw(game.board);

    if (winner) game.winner = winner;
    if (draw) game.draw = true;
    if (!winner && !draw) game.turn = game.turn === 'X' ? 'O' : 'X';

    io.to(roomId).emit('boardUpdate', {
      board: game.board,
      turn: game.turn,
      winner: game.winner,
      draw: game.draw,
      lastMove: index
    });
  });

  socket.on('restart', () => {
    const roomId = socket.roomId;
    if (!roomId || !games.has(roomId)) return;

    const game = games.get(roomId);
    if (game.players.length < 2) return;

    game.board = getEmptyBoard();
    game.turn = 'X';
    game.winner = null;
    game.draw = false;

    io.to(roomId).emit('boardUpdate', {
      board: game.board,
      turn: game.turn,
      winner: null,
      draw: false,
      restart: true
    });
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && games.has(roomId)) {
      const game = games.get(roomId);
      const leftPlayer = game.players.find(p => p.id === socket.id);
      const gameWasOver = !!game.winner || !!game.draw;
      game.players = game.players.filter(p => p.id !== socket.id);
      if (game.players.length === 0) {
        games.delete(roomId);
      } else {
        io.to(roomId).emit('playerLeft', {
          players: game.players,
          leftPlayerName: leftPlayer?.name,
          leftPlayerSymbol: leftPlayer?.symbol,
          forfeited: !gameWasOver
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Tic-Tac-Toe server running at http://localhost:${PORT}`);
});
