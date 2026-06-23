import { createRoomController } from "./game-room.js";

const SIZE = 6;
const SHIPS = [
  { id: "carrier", name: "Carrier", length: 3 },
  { id: "cruiser", name: "Cruiser", length: 3 },
  { id: "destroyer", name: "Destroyer", length: 2 },
  { id: "submarine", name: "Submarine", length: 2 },
  { id: "patrol", name: "Patrol", length: 2 }
];
const FLEET_SIZE = SHIPS.reduce((total, ship) => total + ship.length, 0);

const ownGrid = document.querySelector("#ownOcean");
const targetGrid = document.querySelector("#targetOcean");
const shipStatus = document.querySelector("#shipStatus");
const shipPicker = document.querySelector("#shipPicker");
const rotateShipBtn = document.querySelector("#rotateShipBtn");
const randomFleetBtn = document.querySelector("#randomFleetBtn");
const readyFleetBtn = document.querySelector("#readyFleetBtn");
const placementControls = document.querySelector(".placement-controls");

let selectedShipId = SHIPS[0].id;
let selectedDirection = "horizontal";
let isStartingBattle = false;

for (const ship of SHIPS) {
  const option = document.createElement("option");
  option.value = ship.id;
  option.textContent = `${ship.name} (${ship.length})`;
  shipPicker.append(option);
}

const controller = createRoomController({
  gameType: "battleship",
  gameName: "Battleship",
  waitingMessage: "Place your fleet while waiting for opponent.",
  getInitialState: () => ({
    phase: "placement",
    fleets: {
      player1: placeShips(),
      player2: placeShips()
    },
    fleetReady: {
      player1: false,
      player2: false
    },
    shots: {
      player1: [],
      player2: []
    },
    winner: null
  }),
  getResetState: () => ({
    phase: "placement",
    fleets: {
      player1: placeShips(),
      player2: placeShips()
    },
    fleetReady: {
      player1: false,
      player2: false
    },
    shots: {
      player1: [],
      player2: []
    },
    winner: null
  }),
  getPlayerLabels: (room) => ({
    player1: room.fleetReady?.player1 ? "Ready" : "Placing",
    player2: room.fleetReady?.player2 ? "Ready" : "Placing"
  }),
  getPlayingStatus: ({ room, playerKey, opponentKey }) => {
    if (room.phase === "placement") {
      if (room.fleetReady?.[playerKey] && room.fleetReady?.[opponentKey]) return "Launching battle.";
      if (room.fleetReady?.[playerKey]) return "Fleet ready. Waiting for opponent.";
      return "Reposition your ships, then ready your fleet.";
    }
    return room.currentTurn === playerKey ? "Your turn." : "Opponent's turn.";
  },
  onRoomChange: render,
  onReset: clearOceans
});

shipPicker.addEventListener("change", () => {
  selectedShipId = shipPicker.value;
  render();
});

rotateShipBtn.addEventListener("click", () => {
  selectedDirection = selectedDirection === "horizontal" ? "vertical" : "horizontal";
  render();
});

randomFleetBtn.addEventListener("click", () => {
  setMyFleet(placeShips(), false);
});

readyFleetBtn.addEventListener("click", readyFleet);

function render() {
  const room = controller.room;
  if (!room) {
    clearOceans();
    return;
  }

  const myFleet = normalizeFleet(room.fleets?.[controller.playerKey]);
  const enemyFleet = normalizeFleet(room.fleets?.[controller.opponentKey]);
  const enemyShots = room.shots?.[controller.opponentKey] || [];
  const myShots = room.shots?.[controller.playerKey] || [];
  const isPlacement = room.phase !== "battle" && !room.winner;
  const myReady = Boolean(room.fleetReady?.[controller.playerKey]);
  const opponentReady = Boolean(room.fleetReady?.[controller.opponentKey]);

  if (isPlacement && myReady && opponentReady && !isStartingBattle) {
    startBattle();
  }

  renderOcean(ownGrid, myFleet, enemyShots, {
    isTarget: false,
    isPlacement,
    isReady: myReady
  });
  renderOcean(targetGrid, enemyFleet, myShots, {
    isTarget: true,
    isPlacement,
    isReady: myReady
  });

  placementControls.classList.toggle("is-hidden", room.status === "finished");
  shipPicker.disabled = !room || myReady || room.phase === "battle";
  rotateShipBtn.disabled = !room || myReady || room.phase === "battle";
  randomFleetBtn.disabled = !room || myReady || room.phase === "battle";
  readyFleetBtn.disabled = !room || myReady || !isFleetComplete(myFleet) || room.phase === "battle";
  readyFleetBtn.textContent = myReady ? "Fleet Ready" : "Ready";
  rotateShipBtn.textContent = selectedDirection === "horizontal" ? "Horizontal" : "Vertical";

  const myHits = countHits(myFleet, enemyShots);
  const enemyHits = countHits(enemyFleet, myShots);
  if (isPlacement) {
    const status = myReady ? "Fleet locked." : `${placedShipCount(myFleet)}/${SHIPS.length} ships placed.`;
    const opponent = opponentReady ? "Opponent ready." : "Opponent placing.";
    shipStatus.textContent = `${status} ${opponent}`;
  } else {
    shipStatus.textContent = `Hits: you ${enemyHits}/${FLEET_SIZE} / opponent ${myHits}/${FLEET_SIZE}`;
  }
}

function renderOcean(target, fleet, shots, options) {
  const { isTarget, isPlacement, isReady } = options;
  const occupied = getOccupiedMap(fleet);
  target.innerHTML = "";
  for (let index = 0; index < SIZE * SIZE; index += 1) {
    const button = document.createElement("button");
    button.className = "ocean-cell";
    button.type = "button";
    const ship = occupied.get(index);
    const wasShot = shots.includes(index);
    if (!isTarget && ship) {
      button.classList.add("ship", `ship-${ship.id}`, `ship-${ship.direction}`);
      button.append(createShipPiece(ship));
    }
    if (!isTarget && isPlacement && !isReady && canPlaceShip(fleet, selectedShipId, index, selectedDirection)) {
      button.classList.add("placement-open");
    }
    if (!isTarget && isPlacement && !isReady && fleet[selectedShipId]?.positions?.includes(index)) {
      button.classList.add("selected-ship");
    }
    if (wasShot) {
      button.classList.add(ship ? "hit" : "miss");
    }
    button.disabled = getCellDisabledState({ isTarget, isPlacement, isReady, wasShot });
    if (isTarget) button.addEventListener("click", () => fireAt(index));
    if (!isTarget && isPlacement && !isReady) button.addEventListener("click", () => moveShip(index));
    target.append(button);
  }
}

async function moveShip(index) {
  const room = controller.room;
  if (!room || room.phase === "battle" || room.fleetReady?.[controller.playerKey]) return;

  const fleet = normalizeFleet(room.fleets?.[controller.playerKey]);
  if (!canPlaceShip(fleet, selectedShipId, index, selectedDirection)) return;

  await setMyFleet({
    ...fleet,
    [selectedShipId]: {
      ...fleet[selectedShipId],
      direction: selectedDirection,
      positions: getShipPositions(index, SHIPS.find((ship) => ship.id === selectedShipId).length, selectedDirection)
    }
  }, false);
}

async function readyFleet() {
  const room = controller.room;
  if (!room || room.phase === "battle") return;

  const myFleet = normalizeFleet(room.fleets?.[controller.playerKey]);
  if (!isFleetComplete(myFleet)) return;

  const opponentReady = Boolean(room.fleetReady?.[controller.opponentKey]);
  await controller.update({
    [`fleets/${controller.playerKey}`]: myFleet,
    [`fleetReady/${controller.playerKey}`]: true,
    phase: opponentReady ? "battle" : "placement",
    currentTurn: opponentReady ? "player1" : room.currentTurn,
    status: opponentReady ? "playing" : room.status
  });
}

async function startBattle() {
  isStartingBattle = true;
  try {
    await controller.update({
      phase: "battle",
      currentTurn: "player1",
      status: "playing"
    });
  } finally {
    isStartingBattle = false;
  }
}

async function setMyFleet(fleet, ready) {
  if (!controller.room) return;
  await controller.update({
    [`fleets/${controller.playerKey}`]: fleet,
    [`fleetReady/${controller.playerKey}`]: ready
  });
}

async function fireAt(index) {
  const room = controller.room;
  if (!room || room.phase !== "battle" || !controller.isMyTurn) return;

  const myShots = [...(room.shots?.[controller.playerKey] || [])];
  if (myShots.includes(index)) return;
  myShots.push(index);

  const enemyFleet = normalizeFleet(room.fleets?.[controller.opponentKey]);
  const enemyPositions = getFleetPositions(enemyFleet);
  const winner = enemyPositions.every((shipIndex) => myShots.includes(shipIndex)) ? controller.playerKey : null;

  await controller.update({
    [`shots/${controller.playerKey}`]: myShots,
    currentTurn: winner ? controller.playerKey : controller.opponentKey,
    status: winner ? "finished" : "playing",
    winner,
    rematchVotes: { player1: false, player2: false }
  });
}

function getCellDisabledState({ isTarget, isPlacement, isReady, wasShot }) {
  if (isTarget) return isPlacement || !controller.isMyTurn || wasShot;
  return !isPlacement || isReady;
}

function countHits(fleet, shots) {
  return getFleetPositions(fleet).filter((index) => shots.includes(index)).length;
}

function placeShips() {
  const fleet = {};
  for (const ship of SHIPS) {
    fleet[ship.id] = {
      id: ship.id,
      direction: "horizontal",
      positions: []
    };
  }

  for (const ship of SHIPS) {
    let placed = false;
    while (!placed) {
      const direction = Math.random() > 0.5 ? "horizontal" : "vertical";
      const start = Math.floor(Math.random() * SIZE * SIZE);
      if (canPlaceShip(fleet, ship.id, start, direction)) {
        fleet[ship.id] = {
          id: ship.id,
          direction,
          positions: getShipPositions(start, ship.length, direction)
        };
        placed = true;
      }
    }
  }
  return fleet;
}

function canPlaceShip(fleet, shipId, start, direction) {
  const ship = SHIPS.find((item) => item.id === shipId);
  if (!ship) return false;

  const positions = getShipPositions(start, ship.length, direction);
  if (positions.length !== ship.length) return false;

  const currentRow = Math.floor(start / SIZE);
  const staysInRow = direction === "vertical" || positions.every((position) => Math.floor(position / SIZE) === currentRow);
  if (!staysInRow) return false;

  const occupied = getOccupiedMap(fleet, shipId);
  return positions.every((position) => position >= 0 && position < SIZE * SIZE && !occupied.has(position));
}

function getShipPositions(start, length, direction) {
  const positions = [];
  const step = direction === "horizontal" ? 1 : SIZE;
  for (let part = 0; part < length; part += 1) {
    const position = start + part * step;
    if (position >= SIZE * SIZE) break;
    positions.push(position);
  }
  return positions;
}

function getOccupiedMap(fleet, excludedShipId = "") {
  const occupied = new Map();
  for (const ship of Object.values(normalizeFleet(fleet))) {
    if (ship.id === excludedShipId) continue;
    const definition = SHIPS.find((item) => item.id === ship.id) || ship;
    for (const [segment, position] of (ship.positions || []).entries()) {
      occupied.set(position, {
        ...definition,
        direction: ship.direction,
        segmentType: getSegmentType(segment, definition.length)
      });
    }
  }
  return occupied;
}

function createShipPiece(ship) {
  const piece = document.createElement("span");
  piece.className = `ship-piece ship-${ship.direction} ship-segment-${ship.segmentType}`;
  piece.setAttribute("aria-hidden", "true");
  return piece;
}

function getSegmentType(segment, length) {
  if (segment === 0) return "stern";
  if (segment === length - 1) return "bow";
  return "mid";
}

function getFleetPositions(fleet) {
  return Object.values(normalizeFleet(fleet)).flatMap((ship) => ship.positions || []);
}

function placedShipCount(fleet) {
  return Object.values(normalizeFleet(fleet)).filter((ship) => ship.positions?.length).length;
}

function isFleetComplete(fleet) {
  const normalized = normalizeFleet(fleet);
  const positions = getFleetPositions(normalized);
  return SHIPS.every((ship) => normalized[ship.id]?.positions?.length === ship.length) && new Set(positions).size === FLEET_SIZE;
}

function normalizeFleet(fleet) {
  if (!fleet) return placeShips();
  if (Array.isArray(fleet)) return normalizeLegacyFleet(fleet);

  const normalized = {};
  for (const ship of SHIPS) {
    const existing = fleet[ship.id] || {};
    normalized[ship.id] = {
      id: ship.id,
      direction: existing.direction || "horizontal",
      positions: Array.isArray(existing.positions) ? existing.positions.slice(0, ship.length) : []
    };
  }
  return normalized;
}

function normalizeLegacyFleet(fleet) {
  const normalized = {};
  let cursor = 0;
  for (const ship of SHIPS) {
    const positions = fleet.slice(cursor, cursor + ship.length);
    normalized[ship.id] = {
      id: ship.id,
      direction: "horizontal",
      positions
    };
    cursor += ship.length;
  }
  return normalized;
}

function clearOceans() {
  ownGrid.innerHTML = "";
  targetGrid.innerHTML = "";
  placementControls.classList.remove("is-hidden");
  shipStatus.textContent = "Place your fleet to begin.";
}
