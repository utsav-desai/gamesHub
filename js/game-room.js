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
  joinRoom,
  playerId,
  removeRoom,
  subscribeToRoom,
  updateRoom
} from "./room.js";

export function createRoomController(options) {
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
    postGame: document.querySelector("#postGameActions"),
    playerOne: document.querySelector("#playerOneBadge"),
    playerTwo: document.querySelector("#playerTwoBadge")
  };

  let activeRoomCode = "";
  let activePlayerKey = "";
  let activeRoom = null;
  let unsubscribeRoom = null;

  const api = {
    els,
    get room() {
      return activeRoom;
    },
    get roomCode() {
      return activeRoomCode;
    },
    get playerKey() {
      return activePlayerKey;
    },
    get opponentKey() {
      return getOpponentKey(activePlayerKey);
    },
    get isMyTurn() {
      return activeRoom?.status === "playing" && activeRoom.currentTurn === activePlayerKey && !activeRoom.winner;
    },
    setStatus,
    update(values) {
      return updateRoom(activeRoomCode, values);
    },
    finish(winner, extra = {}) {
      return updateRoom(activeRoomCode, {
        status: "finished",
        winner,
        rematchVotes: { player1: false, player2: false },
        ...extra
      });
    }
  };

  els.nameInput.value = getStoredPlayerName();
  setRoomControls(false);

  els.createBtn.addEventListener("click", handleCreateRoom);
  els.joinBtn.addEventListener("click", () => handleJoinRoom(els.roomInput.value));
  els.copyBtn.addEventListener("click", handleCopyCode);
  els.shareBtn.addEventListener("click", handleShare);
  els.leaveBtn.addEventListener("click", handleLeaveRoom);
  els.rematchBtn.addEventListener("click", handleRematch);
  els.roomInput.addEventListener("input", () => {
    els.roomInput.value = normalizeRoomCode(els.roomInput.value);
  });

  const urlRoomCode = getRoomCodeFromUrl();
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
      const result = await createRoom(options.gameType, els.nameInput.value, options.getInitialState());
      connectToRoom(result.roomCode, result.playerKey);
      setStatus(options.waitingMessage || "Waiting for opponent.");
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
      const result = await joinRoom(roomCode, els.nameInput.value, options.gameType);
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
      renderPlayers(room);
      renderStatus(room);
      els.postGame.classList.toggle("is-visible", room.status === "finished");
      options.onRoomChange(api);
    }, (error) => setStatus(error.message, true));
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
        ...options.getResetState(activeRoom),
        status: "playing",
        winner: null,
        currentTurn: options.getResetTurn ? options.getResetTurn(activeRoom) : "player1",
        rematchVotes: { player1: false, player2: false }
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
      await navigator.share({ title: `Join my ${options.gameName} room`, url });
      return;
    }

    await copyText(url);
    setStatus("Invite link copied.");
  }

  function renderPlayers(room) {
    const one = room.players?.player1;
    const two = room.players?.player2;
    const labels = options.getPlayerLabels ? options.getPlayerLabels(room) : { player1: "Player 1", player2: "Player 2" };

    els.playerOne.querySelector("strong").textContent = one?.name || "Player 1";
    els.playerOne.querySelector("span").textContent = one ? `${labels.player1} ${one.connected === false ? "Offline" : "Ready"}` : "Waiting";
    els.playerTwo.querySelector("strong").textContent = two?.name || "Player 2";
    els.playerTwo.querySelector("span").textContent = two ? `${labels.player2} ${two.connected === false ? "Offline" : "Ready"}` : "Waiting";
    els.playerOne.classList.toggle("active", room.currentTurn === "player1" && room.status === "playing");
    els.playerTwo.classList.toggle("active", room.currentTurn === "player2" && room.status === "playing");
  }

  function renderStatus(room) {
    const opponent = room.players?.[getOpponentKey(activePlayerKey)];

    if (room.status === "waiting") {
      setStatus(opponent && opponent.connected === false ? "Opponent disconnected." : options.waitingMessage || "Waiting for opponent.");
      return;
    }

    if (room.status === "finished") {
      if (room.winner === "draw") {
        setStatus("Draw.");
      } else if (room.winner === activePlayerKey) {
        setStatus("You won.");
      } else if (room.winner) {
        setStatus("You lost.");
      } else {
        setStatus("Game finished.");
      }

      const myVote = Boolean(room.rematchVotes?.[activePlayerKey]);
      const otherVote = Boolean(room.rematchVotes?.[getOpponentKey(activePlayerKey)]);
      els.rematchBtn.textContent = myVote ? "Rematch voted" : "Rematch";
      els.rematchBtn.disabled = myVote && !otherVote;
      return;
    }

    if (opponent?.connected === false) {
      setStatus("Opponent disconnected. You can wait or leave.");
      return;
    }

    setStatus(options.getPlayingStatus ? options.getPlayingStatus(api) : room.currentTurn === activePlayerKey ? "Your turn." : "Opponent's turn.");
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
    els.playerOne.querySelector("strong").textContent = "Player 1";
    els.playerOne.querySelector("span").textContent = "";
    els.playerTwo.querySelector("strong").textContent = "Player 2";
    els.playerTwo.querySelector("span").textContent = "";
    history.replaceState(null, "", location.pathname);
    options.onReset?.();
    setStatus(message);
  }

  function rememberName() {
    savePlayerName(els.nameInput.value);
    els.nameInput.value = getStoredPlayerName();
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

  return api;
}
