import { createRoomController } from "./game-room.js";

const SIZE = 5;
const TURN_MS = 10000;
const numbers = Array.from({ length: 25 }, (_, index) => index + 1);
const callGrid = document.querySelector("#callGrid");
const myBoard = document.querySelector("#myBingoBoard");
const lineScore = document.querySelector("#lineScore");
const bingoLetters = [...document.querySelectorAll(".bingo-word span")];
let lastTimedOutTurn = "";

const controller = createRoomController({
  gameType: "bingo",
  gameName: "Bingo 1v1",
  waitingMessage: "Waiting for opponent.",
  getInitialState: () => ({
    boards: {
      player1: shuffle(numbers),
      player2: shuffle(numbers)
    },
    called: [],
    turnStartedAt: null,
    winner: null
  }),
  getResetState: () => ({
    boards: {
      player1: shuffle(numbers),
      player2: shuffle(numbers)
    },
    called: [],
    turnStartedAt: Date.now(),
    winner: null
  }),
  getPlayerLabels: () => ({ player1: "Caller", player2: "Caller" }),
  onRoomChange: render,
  onReset: clearBoards
});

setInterval(updateTurnTimer, 200);

numbers.forEach((number) => {
  const button = document.createElement("button");
  button.className = "number-chip";
  button.type = "button";
  button.textContent = number;
  button.addEventListener("click", () => callNumber(number));
  callGrid.append(button);
});

async function callNumber(number) {
  const room = controller.room;
  if (!room || !controller.isMyTurn || room.called?.includes(number)) return;
  if (getTurnRemaining(room) <= 0) {
    await updateTurnTimer();
    return;
  }
  const called = [...(room.called || []), number];
  const winner = getWinner(room.boards, called);
  await controller.update({
    called,
    currentTurn: winner ? controller.playerKey : controller.opponentKey,
    status: winner ? "finished" : "playing",
    winner,
    turnStartedAt: Date.now(),
    rematchVotes: { player1: false, player2: false }
  });
}

function render() {
  const room = controller.room;
  if (!room) {
    clearBoards();
    return;
  }

  const myLines = getCompletedLines(room.boards?.[controller.playerKey] || [], room.called || []);
  renderBoard(myBoard, room.boards?.[controller.playerKey] || [], room.called || [], myLines);
  [...callGrid.children].forEach((button) => {
    const number = Number(button.textContent);
    button.disabled = !controller.isMyTurn || room.called?.includes(number);
    button.classList.toggle("called", room.called?.includes(number));
  });

  lineScore.textContent = `Lines: ${Math.min(myLines.length, 5)} of 5`;
  bingoLetters.forEach((letter, index) => {
    letter.classList.toggle("crossed", index < myLines.length);
  });
  updateTurnTimer();
}

function renderBoard(target, board, called, lines) {
  target.innerHTML = "";
  board.forEach((number) => {
    const cell = document.createElement("span");
    cell.className = "bingo-cell";
    cell.textContent = number;
    cell.classList.toggle("marked", called.includes(number));
    target.append(cell);
  });
  lines.forEach((line) => {
    const marker = document.createElement("span");
    marker.className = `bingo-line ${line.type}`;
    if (line.type === "row") marker.style.setProperty("--line-index", line.index);
    if (line.type === "col") marker.style.setProperty("--line-index", line.index);
    target.append(marker);
  });
}

function clearBoards() {
  myBoard.innerHTML = "";
  lineScore.textContent = "Lines: 0 of 5";
  myBoard.classList.remove("timer-active", "timer-warning");
  myBoard.style.removeProperty("--timer-progress");
  bingoLetters.forEach((letter) => letter.classList.remove("crossed"));
}

async function updateTurnTimer() {
  const room = controller.room;
  if (!room || room.status !== "playing" || room.winner) {
    myBoard.classList.remove("timer-active", "timer-warning");
    myBoard.style.removeProperty("--timer-progress");
    return;
  }

  if (!room.turnStartedAt) {
    await controller.update({ turnStartedAt: Date.now() });
    return;
  }

  const remaining = getTurnRemaining(room);
  const progress = Math.max(0, Math.min(1, remaining / TURN_MS));
  const myLines = getCompletedLines(room.boards?.[controller.playerKey] || [], room.called || []);
  const seconds = Math.ceil(remaining / 1000);
  const isMyTurn = room.currentTurn === controller.playerKey;

  myBoard.classList.toggle("timer-active", isMyTurn);
  myBoard.classList.toggle("timer-warning", isMyTurn && remaining <= 3000);
  myBoard.style.setProperty("--timer-progress", `${progress * 100}%`);
  lineScore.textContent = `Lines: ${Math.min(myLines.length, 5)} of 5 · ${isMyTurn ? `${seconds}s to call` : `${seconds}s for opponent`}`;

  if (remaining > 0 || lastTimedOutTurn === `${room.currentTurn}:${room.turnStartedAt}`) return;

  lastTimedOutTurn = `${room.currentTurn}:${room.turnStartedAt}`;
  await controller.update({
    currentTurn: room.currentTurn === "player1" ? "player2" : "player1",
    turnStartedAt: Date.now(),
    rematchVotes: { player1: false, player2: false }
  });
}

function getTurnRemaining(room) {
  if (!room?.turnStartedAt) return TURN_MS;
  return Math.max(0, TURN_MS - (Date.now() - Number(room.turnStartedAt)));
}

function getWinner(boards, called) {
  const p1 = getCompletedLines(boards.player1, called).length;
  const p2 = getCompletedLines(boards.player2, called).length;
  if (p1 >= 5 && p2 >= 5) return "draw";
  if (p1 >= 5) return "player1";
  if (p2 >= 5) return "player2";
  return null;
}

function getCompletedLines(board, called) {
  if (!board?.length) return [];
  const lines = [];
  for (let row = 0; row < SIZE; row += 1) {
    if ([0, 1, 2, 3, 4].every((col) => called.includes(board[row * SIZE + col]))) {
      lines.push({ type: "row", index: row });
    }
  }
  for (let col = 0; col < SIZE; col += 1) {
    if ([0, 1, 2, 3, 4].every((row) => called.includes(board[row * SIZE + col]))) {
      lines.push({ type: "col", index: col });
    }
  }
  if ([0, 6, 12, 18, 24].every((idx) => called.includes(board[idx]))) lines.push({ type: "diag-down", index: 0 });
  if ([4, 8, 12, 16, 20].every((idx) => called.includes(board[idx]))) lines.push({ type: "diag-up", index: 0 });
  return lines;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}
