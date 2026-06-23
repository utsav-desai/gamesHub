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
let dragState = null;

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
  selectedDirection = getSelectedShipDirection();
  render();
});

rotateShipBtn.addEventListener("click", () => {
  rotateSelectedShip();
});

randomFleetBtn.addEventListener("click", () => {
  setMyFleet(placeShips(), false);
});

readyFleetBtn.addEventListener("click", readyFleet);
ownGrid.addEventListener("pointerdown", startShipDrag);
window.addEventListener("pointermove", moveShipDrag);
window.addEventListener("pointerup", endShipDrag);
window.addEventListener("pointercancel", cancelShipDrag);

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
    isReady: myReady,
    preview: getDragPreview()
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
    button.dataset.index = String(index);
    const ship = occupied.get(index);
    const wasShot = shots.includes(index);
    if (!isTarget && ship) {
      button.classList.add("ship", `ship-${ship.id}`, `ship-${ship.direction}`);
      button.dataset.shipId = ship.id;
      button.append(createShipPiece(ship));
    }
    if (!isTarget && isPlacement && !isReady && !dragState && canPlaceShip(fleet, selectedShipId, index, selectedDirection)) {
      button.classList.add("placement-open");
    }
    if (!isTarget && isPlacement && !isReady && fleet[selectedShipId]?.positions?.includes(index)) {
      button.classList.add("selected-ship");
    }
    if (!isTarget && dragState?.shipId === ship?.id) {
      button.classList.add("dragging-ship");
    }
    if (!isTarget && options.preview?.positions?.includes(index)) {
      button.classList.add(options.preview.valid ? "drag-preview-valid" : "drag-preview-invalid");
    }
    if (wasShot) {
      button.classList.add(ship ? "hit" : "miss");
    }
    button.disabled = getCellDisabledState({ isTarget, isPlacement, isReady, wasShot });
    if (isTarget) button.addEventListener("click", () => fireAt(index));
    target.append(button);
  }
}

function startShipDrag(event) {
  const room = controller.room;
  if (!room || room.phase === "battle" || room.fleetReady?.[controller.playerKey]) return;

  const cell = event.target.closest(".ocean-cell.ship");
  if (!cell || !ownGrid.contains(cell)) return;

  const index = Number(cell.dataset.index);
  const fleet = normalizeFleet(room.fleets?.[controller.playerKey]);
  const occupied = getOccupiedMap(fleet);
  const ship = occupied.get(index);
  if (!ship) return;

  event.preventDefault();
  selectedShipId = ship.id;
  selectedDirection = fleet[ship.id].direction;
  shipPicker.value = ship.id;

  const originPositions = fleet[ship.id].positions || [];
  dragState = {
    pointerId: event.pointerId,
    shipId: ship.id,
    direction: fleet[ship.id].direction,
    offset: Math.max(0, originPositions.indexOf(index)),
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    previewStart: originPositions[0],
    hasMoved: false,
    valid: true,
    ghost: createDragGhost(fleet[ship.id])
  };

  ownGrid.setPointerCapture?.(event.pointerId);
  document.body.classList.add("is-dragging-ship");
  positionDragGhost(event.clientX, event.clientY);
  updateDragPreview(event.clientX, event.clientY);
  render();
}

function moveShipDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();

  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
  dragState.hasMoved = dragState.hasMoved || distance > 4;
  dragState.currentX = event.clientX;
  dragState.currentY = event.clientY;
  positionDragGhost(event.clientX, event.clientY);
  updateDragPreview(event.clientX, event.clientY);
  render();
}

async function endShipDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();

  const completedDrag = dragState.hasMoved && dragState.valid;
  const shipId = dragState.shipId;
  const direction = dragState.direction;
  const previewStart = dragState.previewStart;
  clearDragState();

  if (!completedDrag) {
    render();
    return;
  }

  const room = controller.room;
  if (!room || room.phase === "battle" || room.fleetReady?.[controller.playerKey]) return;

  const fleet = normalizeFleet(room.fleets?.[controller.playerKey]);
  if (!canPlaceShip(fleet, shipId, previewStart, direction)) return;

  await setMyFleet({
    ...fleet,
    [shipId]: {
      ...fleet[shipId],
      direction,
      positions: getShipPositions(previewStart, getShipDefinition(shipId).length, direction)
    }
  }, false);
}

function cancelShipDrag(event) {
  if (dragState && event.pointerId === dragState.pointerId) {
    clearDragState();
    render();
  }
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

async function rotateSelectedShip() {
  const room = controller.room;
  if (!room || room.phase === "battle" || room.fleetReady?.[controller.playerKey]) return;

  const fleet = normalizeFleet(room.fleets?.[controller.playerKey]);
  const ship = fleet[selectedShipId];
  if (!ship?.positions?.length) return;

  const nextDirection = ship.direction === "horizontal" ? "vertical" : "horizontal";

  if (!canPlaceShip(fleet, selectedShipId, ship.positions[0], nextDirection)) {
    render();
    return;
  }

  selectedDirection = nextDirection;
  await setMyFleet({
    ...fleet,
    [selectedShipId]: {
      ...ship,
      direction: nextDirection,
      positions: getShipPositions(ship.positions[0], getShipDefinition(selectedShipId).length, nextDirection)
    }
  }, false);
}

function updateDragPreview(clientX, clientY) {
  if (!dragState) return;

  const cell = getCellFromPoint(clientX, clientY);
  if (!cell) {
    dragState.previewStart = -1;
    dragState.valid = false;
    return;
  }

  const dropIndex = Number(cell.dataset.index);
  const step = dragState.direction === "horizontal" ? 1 : SIZE;
  const previewStart = dropIndex - dragState.offset * step;
  const fleet = normalizeFleet(controller.room?.fleets?.[controller.playerKey]);
  dragState.previewStart = previewStart;
  dragState.valid = canPlaceShip(fleet, dragState.shipId, previewStart, dragState.direction);
}

function getDragPreview() {
  if (!dragState) return null;

  const length = getShipDefinition(dragState.shipId).length;
  const positions = getShipPositions(dragState.previewStart, length, dragState.direction)
    .filter((position) => position >= 0 && position < SIZE * SIZE);
  if (!positions.length) return null;

  return {
    valid: dragState.valid,
    positions
  };
}

function getCellFromPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const cell = element?.closest?.(".ocean-cell");
  return cell && ownGrid.contains(cell) ? cell : null;
}

function createDragGhost(ship) {
  const ghost = document.createElement("div");
  ghost.className = `ship-drag-ghost ship-${ship.id} ship-${ship.direction}`;
  for (const [segment] of ship.positions.entries()) {
    const piece = createShipPiece({
      ...getShipDefinition(ship.id),
      direction: ship.direction,
      segmentType: getSegmentType(segment, ship.positions.length)
    });
    ghost.append(piece);
  }
  document.body.append(ghost);
  return ghost;
}

function positionDragGhost(clientX, clientY) {
  if (!dragState?.ghost) return;
  dragState.ghost.style.transform = `translate(${clientX}px, ${clientY}px) translate(-50%, -50%)`;
}

function clearDragState() {
  dragState?.ghost?.remove();
  dragState = null;
  document.body.classList.remove("is-dragging-ship");
}

function getSelectedShipDirection() {
  const room = controller.room;
  const fleet = normalizeFleet(room?.fleets?.[controller.playerKey]);
  return fleet[selectedShipId]?.direction || selectedDirection;
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
  const ship = getShipDefinition(shipId);
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
    const definition = getShipDefinition(ship.id) || ship;
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

function getShipDefinition(shipId) {
  return SHIPS.find((ship) => ship.id === shipId);
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
