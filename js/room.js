import {
  child,
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { db, isFirebaseConfigured } from "./firebase-config.js";
import { generateRoomCode, getPlayerId, normalizeRoomCode } from "./utils.js";

export const playerId = getPlayerId();

export function ensureFirebaseReady() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured yet. Paste your Firebase config into js/firebase-config.js.");
  }
}

export function roomRef(roomCode) {
  ensureFirebaseReady();
  return ref(db, `rooms/${normalizeRoomCode(roomCode)}`);
}

export async function createRoom(gameType, name, initialState) {
  ensureFirebaseReady();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomCode = generateRoomCode(attempt > 4 ? 6 : 5);
    const targetRef = roomRef(roomCode);
    const snapshot = await get(targetRef);

    if (!snapshot.exists()) {
      const room = {
        gameType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "waiting",
        players: {
          player1: {
            id: playerId,
            name: cleanName(name),
            symbol: "X",
            connected: true,
            lastSeen: serverTimestamp()
          }
        },
        currentTurn: "player1",
        rematchVotes: {
          player1: false,
          player2: false
        },
        ...initialState
      };

      await set(targetRef, room);
      await setupPresence(roomCode, "player1");
      return { roomCode, playerKey: "player1", room };
    }
  }

  throw new Error("Could not create a unique room. Please try again.");
}

export async function joinRoom(roomCodeInput, name) {
  ensureFirebaseReady();
  const roomCode = normalizeRoomCode(roomCodeInput);

  if (!roomCode) {
    throw new Error("Enter a room code.");
  }

  const targetRef = roomRef(roomCode);
  const existingSnapshot = await get(targetRef);
  if (!existingSnapshot.exists()) {
    throw new Error("Room not found.");
  }

  let joinedAs = null;
  let failure = "";

  const result = await runTransaction(targetRef, (room) => {
    if (!room) {
      return room;
    }

    const players = room.players || {};
    const existingKey = getPlayerKey(room, playerId);
    if (existingKey) {
      joinedAs = existingKey;
      players[existingKey] = {
        ...players[existingKey],
        connected: true,
        lastSeen: Date.now()
      };
      room.players = players;
      if (players.player1 && players.player2 && room.status === "waiting") {
        room.status = "playing";
      }
      room.updatedAt = Date.now();
      return room;
    }

    if (players.player1 && players.player2) {
      failure = "Room full.";
      return;
    }

    joinedAs = players.player1 ? "player2" : "player1";
    players[joinedAs] = {
      id: playerId,
      name: cleanName(name),
      symbol: joinedAs === "player1" ? "X" : "O",
      connected: true,
      lastSeen: Date.now()
    };

    room.players = players;
    room.status = players.player1 && players.player2 && room.status === "waiting" ? "playing" : room.status;
    room.currentTurn = room.currentTurn || "player1";
    room.updatedAt = Date.now();
    return room;
  });

  if (!result.committed) {
    throw new Error(failure || "Could not join room.");
  }

  await setupPresence(roomCode, joinedAs);
  return { roomCode, playerKey: joinedAs, room: result.snapshot.val() };
}

export function subscribeToRoom(roomCode, callback, onError) {
  const unsubscribe = onValue(roomRef(roomCode), (snapshot) => {
    callback(snapshot.val());
  }, onError);

  return unsubscribe;
}

export async function updateRoom(roomCode, values) {
  return update(roomRef(roomCode), {
    ...values,
    updatedAt: serverTimestamp()
  });
}

export async function removeRoom(roomCode) {
  return remove(roomRef(roomCode));
}

export function getPlayerKey(room, id = playerId) {
  if (!room?.players) return null;
  if (room.players.player1?.id === id) return "player1";
  if (room.players.player2?.id === id) return "player2";
  return null;
}

export function getOpponentKey(playerKey) {
  return playerKey === "player1" ? "player2" : "player1";
}

export function isCurrentPlayerTurn(room, playerKey) {
  return room?.status === "playing" && room.currentTurn === playerKey && !room.winner;
}

async function setupPresence(roomCode, playerKey) {
  const playerPath = child(roomRef(roomCode), `players/${playerKey}`);
  await update(playerPath, {
    connected: true,
    lastSeen: serverTimestamp()
  });
  await onDisconnect(playerPath).update({
    connected: false,
    lastSeen: serverTimestamp()
  });
}

function cleanName(name) {
  return (name || "Player").trim().slice(0, 24) || "Player";
}
