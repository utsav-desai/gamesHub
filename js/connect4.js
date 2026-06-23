import { createRoomController } from "./game-room.js";

const ROWS = 6;
const COLS = 7;
const boardEl = document.querySelector("#connectBoard");
const dropControls = document.querySelector("#dropControls");
const cells = [];
const dropButtons = [];

for (let col = 0; col < COLS; col += 1) {
  const button = document.createElement("button");
  button.className = "drop-btn";
  button.type = "button";
  button.textContent = "Drop";
  button.dataset.col = String(col);
  button.setAttribute("aria-label", `Drop in column ${col + 1}`);
  button.addEventListener("click", () => playColumn(col));
  dropControls.append(button);
  dropButtons.push(button);
}

for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    const cell = document.createElement("span");
    cell.className = "c4-cell";
    cell.dataset.col = String(col);
    cell.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);
    boardEl.append(cell);
    cells.push(cell);
  }
}

const controller = createRoomController({
  gameType: "connect4",
  gameName: "Connect 4",
  waitingMessage: "Waiting for opponent.",
  getInitialState: () => ({
    board: Array(ROWS * COLS).fill(""),
    winner: null,
    winningLine: null
  }),
  getResetState: () => ({
    board: Array(ROWS * COLS).fill(""),
    winner: null,
    winningLine: null
  }),
  getPlayerLabels: () => ({ player1: "Red", player2: "Yellow" }),
  onRoomChange: render,
  onReset: () => render({ room: null })
});

async function playColumn(col) {
  const room = controller.room;
  if (!room || !controller.isMyTurn) return;
  const board = [...room.board];
  const row = findOpenRow(board, col);
  if (row === -1) return;

  const mark = controller.playerKey === "player1" ? "R" : "Y";
  board[indexOf(row, col)] = mark;
  const result = evaluate(board);
  await controller.update({
    board,
    currentTurn: result.winner ? controller.playerKey : controller.opponentKey,
    status: result.winner ? "finished" : "playing",
    winner: result.winner === "draw" ? "draw" : result.winner ? controller.playerKey : null,
    winningLine: result.line,
    rematchVotes: { player1: false, player2: false }
  });
}

function render() {
  const room = controller.room;
  const board = room?.board || Array(ROWS * COLS).fill("");
  cells.forEach((cell, index) => {
    const mark = board[index];
    cell.className = "c4-cell";
    if (mark) cell.classList.add(mark === "R" ? "red" : "yellow");
    if (room?.winningLine?.includes(index)) cell.classList.add("win");
  });
  dropButtons.forEach((button) => {
    button.disabled = !room || !controller.isMyTurn || findOpenRow(board, Number(button.dataset.col)) === -1;
  });
}

function findOpenRow(board, col) {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (!board[indexOf(row, col)]) return row;
  }
  return -1;
}

function indexOf(row, col) {
  return row * COLS + col;
}

function evaluate(board) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const mark = board[indexOf(row, col)];
      if (!mark) continue;
      for (const [dr, dc] of directions) {
        const line = [];
        for (let step = 0; step < 4; step += 1) {
          const nextRow = row + dr * step;
          const nextCol = col + dc * step;
          if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) break;
          const idx = indexOf(nextRow, nextCol);
          if (board[idx] !== mark) break;
          line.push(idx);
        }
        if (line.length === 4) return { winner: mark, line };
      }
    }
  }
  return { winner: board.every(Boolean) ? "draw" : null, line: null };
}
