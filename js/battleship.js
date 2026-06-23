import { createRoomController } from "./game-room.js";

const SIZE = 6;
const SHIPS = [3, 3, 2, 2, 2];
const ownGrid = document.querySelector("#ownOcean");
const targetGrid = document.querySelector("#targetOcean");
const shipStatus = document.querySelector("#shipStatus");

const controller = createRoomController({
  gameType: "battleship",
  gameName: "Battleship",
  waitingMessage: "Waiting for opponent.",
  getInitialState: () => ({
    fleets: {
      player1: placeShips(),
      player2: placeShips()
    },
    shots: {
      player1: [],
      player2: []
    },
    winner: null
  }),
  getResetState: () => ({
    fleets: {
      player1: placeShips(),
      player2: placeShips()
    },
    shots: {
      player1: [],
      player2: []
    },
    winner: null
  }),
  getPlayerLabels: () => ({ player1: "Fleet", player2: "Fleet" }),
  onRoomChange: render,
  onReset: clearOceans
});

function render() {
  const room = controller.room;
  if (!room) {
    clearOceans();
    return;
  }

  const myFleet = room.fleets?.[controller.playerKey] || [];
  const enemyFleet = room.fleets?.[controller.opponentKey] || [];
  const enemyShots = room.shots?.[controller.opponentKey] || [];
  const myShots = room.shots?.[controller.playerKey] || [];

  renderOcean(ownGrid, myFleet, enemyShots, false);
  renderOcean(targetGrid, enemyFleet, myShots, true);

  const myHits = countHits(myFleet, enemyShots);
  const enemyHits = countHits(enemyFleet, myShots);
  shipStatus.textContent = `Hits: you ${enemyHits}/${enemyFleet.length} / opponent ${myHits}/${myFleet.length}`;
}

function renderOcean(target, fleet, shots, isTarget) {
  target.innerHTML = "";
  for (let index = 0; index < SIZE * SIZE; index += 1) {
    const button = document.createElement("button");
    button.className = "ocean-cell";
    button.type = "button";
    const hasShip = fleet.includes(index);
    const wasShot = shots.includes(index);
    if (!isTarget && hasShip) button.classList.add("ship");
    if (wasShot) button.classList.add(hasShip ? "hit" : "miss");
    button.textContent = wasShot ? hasShip ? "X" : "" : "";
    button.disabled = !isTarget || !controller.isMyTurn || wasShot;
    if (isTarget) button.addEventListener("click", () => fireAt(index));
    target.append(button);
  }
}

async function fireAt(index) {
  const room = controller.room;
  if (!room || !controller.isMyTurn) return;

  const myShots = [...(room.shots?.[controller.playerKey] || [])];
  if (myShots.includes(index)) return;
  myShots.push(index);

  const enemyFleet = room.fleets?.[controller.opponentKey] || [];
  const winner = enemyFleet.every((shipIndex) => myShots.includes(shipIndex)) ? controller.playerKey : null;

  await controller.update({
    [`shots/${controller.playerKey}`]: myShots,
    currentTurn: winner ? controller.playerKey : controller.opponentKey,
    status: winner ? "finished" : "playing",
    winner,
    rematchVotes: { player1: false, player2: false }
  });
}

function countHits(fleet, shots) {
  return fleet.filter((index) => shots.includes(index)).length;
}

function placeShips() {
  const occupied = new Set();
  for (const length of SHIPS) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() > 0.5;
      const row = Math.floor(Math.random() * SIZE);
      const col = Math.floor(Math.random() * SIZE);
      const positions = [];
      for (let part = 0; part < length; part += 1) {
        const nextRow = row + (horizontal ? 0 : part);
        const nextCol = col + (horizontal ? part : 0);
        if (nextRow >= SIZE || nextCol >= SIZE) break;
        positions.push(nextRow * SIZE + nextCol);
      }
      if (positions.length === length && positions.every((pos) => !occupied.has(pos))) {
        positions.forEach((pos) => occupied.add(pos));
        placed = true;
      }
    }
  }
  return [...occupied];
}

function clearOceans() {
  ownGrid.innerHTML = "";
  targetGrid.innerHTML = "";
  shipStatus.textContent = "Hits: you 0/12 / opponent 0/12";
}
