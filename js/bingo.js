import { createRoomController } from "./game-room.js";

const SIZE = 5;
const numbers = Array.from({ length: 25 }, (_, index) => index + 1);
const callGrid = document.querySelector("#callGrid");
const myBoard = document.querySelector("#myBingoBoard");
const opponentBoard = document.querySelector("#opponentBingoBoard");
const lineScore = document.querySelector("#lineScore");

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
    winner: null
  }),
  getResetState: () => ({
    boards: {
      player1: shuffle(numbers),
      player2: shuffle(numbers)
    },
    called: [],
    winner: null
  }),
  getPlayerLabels: () => ({ player1: "Caller", player2: "Caller" }),
  onRoomChange: render,
  onReset: clearBoards
});

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
  const called = [...(room.called || []), number];
  const winner = getWinner(room.boards, called);
  await controller.update({
    called,
    currentTurn: winner ? controller.playerKey : controller.opponentKey,
    status: winner ? "finished" : "playing",
    winner,
    rematchVotes: { player1: false, player2: false }
  });
}

function render() {
  const room = controller.room;
  if (!room) {
    clearBoards();
    return;
  }

  renderBoard(myBoard, room.boards?.[controller.playerKey] || [], room.called || [], false);
  renderBoard(opponentBoard, room.boards?.[controller.opponentKey] || [], room.called || [], true);
  [...callGrid.children].forEach((button) => {
    const number = Number(button.textContent);
    button.disabled = !controller.isMyTurn || room.called?.includes(number);
    button.classList.toggle("called", room.called?.includes(number));
  });

  const myLines = countLines(room.boards?.[controller.playerKey] || [], room.called || []);
  const theirLines = countLines(room.boards?.[controller.opponentKey] || [], room.called || []);
  lineScore.textContent = `Lines: you ${myLines} / opponent ${theirLines}`;
}

function renderBoard(target, board, called, compact) {
  target.innerHTML = "";
  board.forEach((number) => {
    const cell = document.createElement("span");
    cell.className = "bingo-cell";
    cell.textContent = compact && !called.includes(number) ? "" : number;
    cell.classList.toggle("marked", called.includes(number));
    target.append(cell);
  });
}

function clearBoards() {
  myBoard.innerHTML = "";
  opponentBoard.innerHTML = "";
  lineScore.textContent = "Lines: you 0 / opponent 0";
}

function getWinner(boards, called) {
  const p1 = countLines(boards.player1, called);
  const p2 = countLines(boards.player2, called);
  if (p1 >= 5 && p2 >= 5) return "draw";
  if (p1 >= 5) return "player1";
  if (p2 >= 5) return "player2";
  return null;
}

function countLines(board, called) {
  if (!board?.length) return 0;
  let lines = 0;
  for (let row = 0; row < SIZE; row += 1) {
    if ([0, 1, 2, 3, 4].every((col) => called.includes(board[row * SIZE + col]))) lines += 1;
  }
  for (let col = 0; col < SIZE; col += 1) {
    if ([0, 1, 2, 3, 4].every((row) => called.includes(board[row * SIZE + col]))) lines += 1;
  }
  if ([0, 6, 12, 18, 24].every((idx) => called.includes(board[idx]))) lines += 1;
  if ([4, 8, 12, 16, 20].every((idx) => called.includes(board[idx]))) lines += 1;
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
