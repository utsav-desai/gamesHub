import {
  buildShareUrl,
  copyText,
  getRoomCodeFromUrl,
  getStoredPlayerName,
  normalizeRoomCode,
  savePlayerName
} from "./utils.js";
import {
  createRoom,
  getOpponentKey,
  getPlayerKey,
  isCurrentPlayerTurn,
  joinRoom,
  playerId,
  removeRoom,
  subscribeToRoom,
  updateRoom
} from "./room.js";

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

const els = {
  nameInput: document.querySelector("#playerName"),
  roomInput: document.querySelector("#roomCodeInput"),
  createBtn: document.querySelector("#createRoomBtn"),
  joinBtn: document.querySelector("#joinRoomBtn"),
  copyBtn: document.querySelector("#copyRoomBtn"),
  leaveBtn: document.querySelector("#leaveRoomBtn"),
  rematchBtn: document.querySelector("#rematchBtn"),
  shareBtn: document.querySelector("#shareBtn"),
  status: document.querySelector("#statusMessage"),
  roomStrip: document.querySelector("#roomStrip"),
  currentRoomCode: document.querySelector("#currentRoomCode"),
  cells: [...document.querySelectorAll("[data-cell]")],
  postGame: document.querySelector("#postGameActions"),
  playerOne: document.querySelector("#playerOneBadge"),
  playerTwo: document.querySelector("#playerTwoBadge")
};

let activeRoomCode = "";
let activePlayerKey = "";
let activeRoom = null;
let unsubscribeRoom = null;

els.nameInput.value = getStoredPlayerName();

els.createBtn.addEventListener("click", handleCreateRoom);
els.joinBtn.addEventListener("click", () => handleJoinRoom(els.roomInput.value));
els.copyBtn.addEventListener("click", handleCopyCode);
els.shareBtn.addEventListener("click", handleShare);
els.leaveBtn.addEventListener("click", handleLeaveRoom);
els.rematchBtn.addEventListener("click", handleRematch);
els.roomInput.addEventListener("input", () => {
  els.roomInput.value = normalizeRoomCode(els.roomInput.value);
});

els.cells.forEach((cell, index) => {
  cell.addEventListener("click", () => handleCellClick(index));
});

const urlRoomCode = getRoomCodeFromUrl();
setRoomControls(false);
if (urlRoomCode) {
  els.roomInput.value = urlRoomCode;
  setStatus("Room code loaded. Add your name and join when ready.");
} else {
  setStatus("Create a room or join one with a code.");
}

async function handleCreateRoom() {
  try {
    lockForm(true);
    rememberName();
    const result = await createRoom("tic-tac-toe", els.nameInput.value, {
      board: ["", "", "", "", "", "", "", "", ""],
      winner: null,
      winningLine: null
    });
    connectToRoom(result.roomCode, result.playerKey);
    setStatus("Waiting for opponent.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    lockForm(false);
  }
}

async function handleJoinRoom(roomCode) {
  try {
    lockForm(true);
    rememberName();
    const result = await joinRoom(roomCode, els.nameInput.value);
    connectToRoom(result.roomCode, result.playerKey);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    lockForm(false);
  }
}

function connectToRoom(roomCode, playerKey) {
  activeRoomCode = roomCode;
  activePlayerKey = playerKey;
  history.replaceState(null, "", `${location.pathname}?room=${roomCode}`);
  els.currentRoomCode.textContent = roomCode;
  els.roomStrip.classList.add("is-visible");
  setRoomControls(true);

  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = subscribeToRoom(roomCode, (room) => {
    if (!room) {
      resetLocalRoom("Room closed.");
      return;
    }
    activeRoom = room;
    activePlayerKey = getPlayerKey(room, playerId) || activePlayerKey;
    renderRoom();
  }, (error) => setStatus(error.message, true));
}

async function handleCellClick(index) {
  if (!activeRoom || !isCurrentPlayerTurn(activeRoom, activePlayerKey)) return;
  if (activeRoom.board?.[index]) return;

  const board = [...activeRoom.board];
  const symbol = activeRoom.players[activePlayerKey].symbol;
  board[index] = symbol;
  const result = evaluateBoard(board);
  const nextTurn = getOpponentKey(activePlayerKey);

  await updateRoom(activeRoomCode, {
    board,
    currentTurn: result.winner ? activePlayerKey : nextTurn,
    status: result.winner ? "finished" : "playing",
    winner: result.winner === "draw" ? "draw" : result.winner ? activePlayerKey : null,
    winningLine: result.line,
    rematchVotes: {
      player1: false,
      player2: false
    }
  });
}

async function handleRematch() {
  if (!activeRoom || !activePlayerKey) return;
  const votes = {
    player1: Boolean(activeRoom.rematchVotes?.player1),
    player2: Boolean(activeRoom.rematchVotes?.player2),
    [activePlayerKey]: true
  };

  if (votes.player1 && votes.player2) {
    await updateRoom(activeRoomCode, {
      board: ["", "", "", "", "", "", "", "", ""],
      status: "playing",
      winner: null,
      winningLine: null,
      currentTurn: "player1",
      rematchVotes: {
        player1: false,
        player2: false
      }
    });
    return;
  }

  await updateRoom(activeRoomCode, { rematchVotes: votes });
}

async function handleLeaveRoom() {
  if (!activeRoomCode) return;

  const roomCode = activeRoomCode;
  const playerKey = activePlayerKey;
  const opponentKey = getOpponentKey(playerKey);
  const opponentExists = Boolean(activeRoom?.players?.[opponentKey]);

  resetLocalRoom("You left the room.");

  if (!opponentExists) {
    await removeRoom(roomCode);
    return;
  }

  await updateRoom(roomCode, {
    [`players/${playerKey}/connected`]: false,
    status: activeRoom?.status === "finished" ? "finished" : "waiting"
  });
}

async function handleCopyCode() {
  if (!activeRoomCode) return;
  await copyText(activeRoomCode);
  setStatus("Room code copied.");
}

async function handleShare() {
  if (!activeRoomCode) return;
  const url = buildShareUrl(activeRoomCode);

  if (navigator.share) {
    await navigator.share({ title: "Join my Tic Tac Toe room", url });
    return;
  }

  await copyText(url);
  setStatus("Invite link copied.");
}

function renderRoom() {
  const room = activeRoom;
  const board = room.board || ["", "", "", "", "", "", "", "", ""];
  const canMove = isCurrentPlayerTurn(room, activePlayerKey);

  els.cells.forEach((cell, index) => {
    const mark = board[index] || "";
    cell.textContent = mark;
    cell.disabled = !canMove || Boolean(mark);
    cell.className = "cell";
    if (mark) cell.classList.add(`mark-${mark.toLowerCase()}`);
    if (room.winningLine?.includes(index)) cell.classList.add("win");
  });

  renderPlayers(room);
  renderStatus(room);
  els.postGame.classList.toggle("is-visible", room.status === "finished");
}

function renderPlayers(room) {
  const playerOne = room.players?.player1;
  const playerTwo = room.players?.player2;
  els.playerOne.querySelector("strong").textContent = playerOne?.name || "Player 1";
  els.playerOne.querySelector("span").textContent = playerOne ? `X ${playerOne.connected === false ? "Offline" : "Ready"}` : "Waiting";
  els.playerTwo.querySelector("strong").textContent = playerTwo?.name || "Player 2";
  els.playerTwo.querySelector("span").textContent = playerTwo ? `O ${playerTwo.connected === false ? "Offline" : "Ready"}` : "Waiting";
  els.playerOne.classList.toggle("active", room.currentTurn === "player1" && room.status === "playing");
  els.playerTwo.classList.toggle("active", room.currentTurn === "player2" && room.status === "playing");
}

function renderStatus(room) {
  const opponentKey = getOpponentKey(activePlayerKey);
  const opponent = room.players?.[opponentKey];

  if (room.status === "waiting") {
    setStatus(opponent && opponent.connected === false ? "Opponent disconnected." : "Waiting for opponent.");
    return;
  }

  if (room.status === "finished") {
    if (room.winner === "draw") {
      setStatus("Draw.");
    } else if (room.winner === activePlayerKey) {
      setStatus("You won.");
    } else {
      setStatus("You lost.");
    }

    const myVote = Boolean(room.rematchVotes?.[activePlayerKey]);
    const otherVote = Boolean(room.rematchVotes?.[opponentKey]);
    els.rematchBtn.textContent = myVote ? "Rematch voted" : "Rematch";
    els.rematchBtn.disabled = myVote && !otherVote;
    return;
  }

  if (opponent?.connected === false) {
    setStatus("Opponent disconnected. You can wait or leave.");
    return;
  }

  setStatus(room.currentTurn === activePlayerKey ? "Your turn." : "Opponent's turn.");
}

function evaluateBoard(board) {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }

  if (board.every(Boolean)) {
    return { winner: "draw", line: null };
  }

  return { winner: null, line: null };
}

function rememberName() {
  savePlayerName(els.nameInput.value);
  els.nameInput.value = getStoredPlayerName();
}

function resetLocalRoom(message) {
  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = null;
  activeRoom = null;
  activeRoomCode = "";
  activePlayerKey = "";
  els.roomStrip.classList.remove("is-visible");
  setRoomControls(false);
  els.postGame.classList.remove("is-visible");
  els.currentRoomCode.textContent = "";
  els.cells.forEach((cell) => {
    cell.textContent = "";
    cell.disabled = true;
    cell.className = "cell";
  });
  els.playerOne.querySelector("strong").textContent = "Player 1";
  els.playerOne.querySelector("span").textContent = "X";
  els.playerTwo.querySelector("strong").textContent = "Player 2";
  els.playerTwo.querySelector("span").textContent = "O";
  history.replaceState(null, "", location.pathname);
  setStatus(message);
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function lockForm(isLocked) {
  els.createBtn.disabled = isLocked;
  els.joinBtn.disabled = isLocked;
}

function setRoomControls(hasRoom) {
  els.copyBtn.disabled = !hasRoom;
  els.shareBtn.disabled = !hasRoom;
  els.leaveBtn.disabled = !hasRoom;
}
