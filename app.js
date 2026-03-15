const socket = io();

const lobby = document.getElementById('lobby');
const gamePanel = document.getElementById('game');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomId');
const joinBtn = document.getElementById('joinBtn');
const lobbyError = document.getElementById('lobbyError');
const turnDisplay = document.getElementById('turnDisplay');
const playersInfo = document.getElementById('playersInfo');
const board = document.getElementById('board');
const resultMessage = document.getElementById('resultMessage');
const restartBtn = document.getElementById('restartBtn');
const leaveBtn = document.getElementById('leaveBtn');

let mySymbol = null;
let currentTurn = null;
let gameOver = false;
let lastPlayers = [];

function showLobby(err) {
  gamePanel.classList.add('hidden');
  lobby.classList.remove('hidden');
  lobbyError.textContent = err || '';
}

function showGame() {
  lobby.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  lobbyError.textContent = '';
}

function renderBoard(boardState) {
  const cells = board.querySelectorAll('.cell');
  cells.forEach((cell, i) => {
    const value = boardState[i];
    cell.textContent = value || '';
    cell.className = 'cell' + (value ? ` ${value.toLowerCase()}` : '');
    cell.disabled = !!value || gameOver || currentTurn !== mySymbol;
    cell.removeAttribute('aria-label');
    cell.setAttribute('aria-label', value ? `Cell ${i + 1}, ${value}` : `Cell ${i + 1}, empty`);
  });
}

function updateTurnDisplay(turn, players, winner, draw) {
  currentTurn = turn;
  gameOver = !!(winner || draw);

  if (winner) {
    turnDisplay.textContent = `${winner} wins!`;
  } else if (draw) {
    turnDisplay.textContent = "It's a draw!";
  } else if (players && players.length === 2) {
    const turnPlayer = players.find(p => p.symbol === turn);
    turnDisplay.textContent = turnPlayer ? `${turnPlayer.name} (${turn}) — your turn` : `${turn}'s turn`;
  } else {
    turnDisplay.textContent = 'Waiting for another player…';
  }

  if (players && players.length) {
    playersInfo.textContent = `You: ${mySymbol} · ${players.map(p => `${p.name} (${p.symbol})`).join(' vs ')}`;
  } else {
    playersInfo.textContent = '';
  }

  resultMessage.textContent = '';
  resultMessage.className = 'result-message';
  if (winner) {
    resultMessage.textContent = `Winner: ${winner}`;
    resultMessage.classList.add(`winner-${winner.toLowerCase()}`);
  } else if (draw) {
    resultMessage.textContent = 'Draw!';
    resultMessage.classList.add('draw');
  }

  restartBtn.classList.toggle('hidden', !gameOver || !players || players.length < 2);
  if (players && players.length) {
    renderBoard(boardState || Array(9).fill(null));
  }
}

// Keep a reference to current board for renderBoard when only updating turn
let boardState = Array(9).fill(null);

socket.on('playerJoined', (data) => {
  const { players, board: b, turn, winner, draw } = data;
  lastPlayers = players || [];
  mySymbol = lastPlayers.find(p => p.id === socket.id)?.symbol || null;
  boardState = b || boardState;
  showGame();
  updateTurnDisplay(turn, lastPlayers, winner, draw);
  renderBoard(boardState);
});

socket.on('boardUpdate', (data) => {
  const { board: b, turn, winner, draw, restart } = data;
  boardState = b || boardState;
  updateTurnDisplay(turn, lastPlayers, winner, draw);
  renderBoard(boardState);
  if (restart) {
    resultMessage.textContent = '';
    resultMessage.className = 'result-message';
    gameOver = false;
  }
});

socket.on('playerLeft', (data) => {
  if (data.players) {
    lastPlayers = data.players;
    const turn = currentTurn || 'X';
    updateTurnDisplay(turn, lastPlayers, null, false);
    const name = data.leftPlayerName || `Player ${data.leftPlayerSymbol || '?'}`;
    const msg = data.forfeited ? `${name} forfeited.` : `${name} left.`;
    turnDisplay.textContent = msg + ' Waiting for someone to join…';
  }
});

socket.on('error', (msg) => {
  lobbyError.textContent = msg || 'Something went wrong';
});

joinBtn.addEventListener('click', () => {
  const name = (playerNameInput.value || '').trim() || 'Player';
  const roomId = (roomIdInput.value || '').trim() || 'default';
  if (!roomId) return;
  lobbyError.textContent = '';
  socket.emit('join', roomId, name);
});

board.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell || cell.disabled) return;
  const index = parseInt(cell.dataset.index, 10);
  if (isNaN(index) || index < 0 || index > 8) return;
  socket.emit('move', index);
});

restartBtn.addEventListener('click', () => {
  socket.emit('restart');
});

leaveBtn.addEventListener('click', () => {
  showLobby();
  mySymbol = null;
  currentTurn = null;
  gameOver = false;
  lastPlayers = [];
  boardState = Array(9).fill(null);
  socket.roomId = null;
});
