import { createRoomController } from "./game-room.js";

const LETTERS = ["S", "M", "R", "T", "P"];
const CATEGORIES = ["name", "place", "animal", "thing"];
const form = document.querySelector("#wordForm");
const inputs = Object.fromEntries(CATEGORIES.map((category) => [category, document.querySelector(`#${category}Input`)]));
const submitBtn = document.querySelector("#submitWordsBtn");
const nextBtn = document.querySelector("#nextRoundBtn");
const letterEl = document.querySelector("#roundLetter");
const roundEl = document.querySelector("#roundNumber");
const scoreEl = document.querySelector("#wordScore");
const revealEl = document.querySelector("#answerReveal");

const controller = createRoomController({
  gameType: "name-place-animal-thing",
  gameName: "Name Place Animal Thing",
  waitingMessage: "Waiting for opponent.",
  getInitialState: () => newGame(),
  getResetState: () => newGame(),
  getResetTurn: () => "both",
  getPlayerLabels: () => ({ player1: "Words", player2: "Words" }),
  getPlayingStatus: (api) => {
    if (api.room.phase === "reveal") return "Answers revealed. Start the next round.";
    return api.room.answers?.[api.playerKey] ? "Answers locked. Waiting for opponent." : "Fill all four words.";
  },
  onRoomChange: render,
  onReset: clearGame
});

form.addEventListener("submit", submitAnswers);
nextBtn.addEventListener("click", nextRound);

function newGame() {
  return {
    round: 0,
    letters: LETTERS,
    phase: "answer",
    answers: {},
    scores: { player1: 0, player2: 0 },
    roundScores: null,
    winner: null,
    currentTurn: "both"
  };
}

async function submitAnswers(event) {
  event.preventDefault();
  const room = controller.room;
  if (!room || room.status !== "playing" || room.phase !== "answer" || room.answers?.[controller.playerKey]) return;

  const answer = Object.fromEntries(CATEGORIES.map((category) => [category, cleanAnswer(inputs[category].value)]));
  const answers = {
    ...(room.answers || {}),
    [controller.playerKey]: answer
  };

  if (answers.player1 && answers.player2) {
    const roundScores = {
      player1: scoreAnswers(answers.player1, room.letters[room.round]),
      player2: scoreAnswers(answers.player2, room.letters[room.round])
    };
    const scores = {
      player1: (room.scores?.player1 || 0) + totalScore(roundScores.player1),
      player2: (room.scores?.player2 || 0) + totalScore(roundScores.player2)
    };

    await controller.update({
      answers,
      roundScores,
      scores,
      phase: "reveal"
    });
    return;
  }

  await controller.update({ answers });
}

async function nextRound() {
  const room = controller.room;
  if (!room || room.phase !== "reveal") return;

  const nextRoundIndex = room.round + 1;
  if (nextRoundIndex >= room.letters.length) {
    await controller.update({
      status: "finished",
      winner: room.scores.player1 === room.scores.player2 ? "draw" : room.scores.player1 > room.scores.player2 ? "player1" : "player2",
      rematchVotes: { player1: false, player2: false }
    });
    return;
  }

  await controller.update({
    round: nextRoundIndex,
    phase: "answer",
    answers: {},
    roundScores: null,
    currentTurn: "both"
  });
}

function render() {
  const room = controller.room;
  if (!room) {
    clearGame();
    return;
  }

  const letter = room.letters?.[room.round] || LETTERS[0];
  letterEl.textContent = letter;
  roundEl.textContent = `Round ${Math.min(room.round + 1, room.letters.length)} of ${room.letters.length}`;
  scoreEl.textContent = `Score: you ${room.scores?.[controller.playerKey] || 0} / opponent ${room.scores?.[controller.opponentKey] || 0}`;

  const alreadySubmitted = Boolean(room.answers?.[controller.playerKey]);
  const canAnswer = room.status === "playing" && room.phase === "answer" && !alreadySubmitted;
  CATEGORIES.forEach((category) => {
    inputs[category].disabled = !canAnswer;
    inputs[category].value = alreadySubmitted ? room.answers[controller.playerKey][category] || "" : inputs[category].value;
  });
  submitBtn.disabled = !canAnswer;
  nextBtn.disabled = room.phase !== "reveal";
  nextBtn.classList.toggle("is-visible", room.phase === "reveal");
  renderReveal(room);
}

function renderReveal(room) {
  revealEl.innerHTML = "";
  if (room.phase !== "reveal" && room.status !== "finished") {
    revealEl.innerHTML = "<p class=\"small-note\">Answers appear here after both players submit.</p>";
    return;
  }

  const rows = CATEGORIES.map((category) => {
    const mine = room.answers?.[controller.playerKey]?.[category] || "-";
    const theirs = room.answers?.[controller.opponentKey]?.[category] || "-";
    const myScore = room.roundScores?.[controller.playerKey]?.[category] || 0;
    const theirScore = room.roundScores?.[controller.opponentKey]?.[category] || 0;
    return `<tr><th>${capitalize(category)}</th><td>${escapeHtml(mine)} <strong>+${myScore}</strong></td><td>${escapeHtml(theirs)} <strong>+${theirScore}</strong></td></tr>`;
  }).join("");

  revealEl.innerHTML = `
    <table class="word-table">
      <thead><tr><th>Category</th><th>You</th><th>Opponent</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function clearGame() {
  letterEl.textContent = "-";
  roundEl.textContent = "Round 0 of 5";
  scoreEl.textContent = "Score: you 0 / opponent 0";
  CATEGORIES.forEach((category) => {
    inputs[category].value = "";
    inputs[category].disabled = true;
  });
  submitBtn.disabled = true;
  nextBtn.disabled = true;
  nextBtn.classList.remove("is-visible");
  revealEl.innerHTML = "<p class=\"small-note\">Answers appear here after both players submit.</p>";
}

function scoreAnswers(answer, letter) {
  return Object.fromEntries(CATEGORIES.map((category) => {
    const value = answer?.[category] || "";
    return [category, value.toUpperCase().startsWith(letter) ? 10 : 0];
  }));
}

function totalScore(scores) {
  return Object.values(scores).reduce((sum, points) => sum + points, 0);
}

function cleanAnswer(value) {
  return value.trim().slice(0, 32);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}
