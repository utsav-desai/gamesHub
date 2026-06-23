import { createRoomController } from "./game-room.js";

const QUESTIONS = [
  {
    text: "Which planet is known as the Red Planet?",
    choices: ["Mars", "Venus", "Jupiter", "Mercury"],
    answer: 0
  },
  {
    text: "What does HTML stand for?",
    choices: ["HyperText Markup Language", "High Transfer Machine Logic", "Home Tool Markup List", "Hyperlink Text Module"],
    answer: 0
  },
  {
    text: "How many sides does a hexagon have?",
    choices: ["5", "6", "7", "8"],
    answer: 1
  },
  {
    text: "Which gas do plants absorb from the air?",
    choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
    answer: 1
  },
  {
    text: "What is 9 x 8?",
    choices: ["64", "72", "81", "98"],
    answer: 1
  }
];

const questionText = document.querySelector("#questionText");
const choicesEl = document.querySelector("#choices");
const scoreEl = document.querySelector("#quizScore");
const progressEl = document.querySelector("#quizProgress");

const controller = createRoomController({
  gameType: "quiz",
  gameName: "Quiz Duel",
  waitingMessage: "Waiting for opponent.",
  getInitialState: () => newQuizState(),
  getResetState: () => newQuizState(),
  getResetTurn: () => "both",
  getPlayerLabels: () => ({ player1: "Score", player2: "Score" }),
  getPlayingStatus: (api) => {
    const answered = Boolean(api.room.answers?.[api.playerKey]);
    return answered ? "Answer locked. Waiting for opponent." : "Choose your answer.";
  },
  onRoomChange: render,
  onReset: clearQuiz
});

function newQuizState() {
  return {
    questionIndex: 0,
    scores: { player1: 0, player2: 0 },
    answers: {},
    winner: null,
    currentTurn: "both"
  };
}

function render() {
  const room = controller.room;
  if (!room) {
    clearQuiz();
    return;
  }

  const question = QUESTIONS[room.questionIndex] || QUESTIONS[0];
  questionText.textContent = question.text;
  progressEl.textContent = `Question ${Math.min(room.questionIndex + 1, QUESTIONS.length)} of ${QUESTIONS.length}`;
  scoreEl.textContent = `Score: you ${room.scores?.[controller.playerKey] || 0} / opponent ${room.scores?.[controller.opponentKey] || 0}`;

  choicesEl.innerHTML = "";
  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice-btn";
    button.type = "button";
    button.textContent = choice;
    button.disabled = room.status !== "playing" || Boolean(room.answers?.[controller.playerKey]);
    button.classList.toggle("selected", room.answers?.[controller.playerKey] === index);
    button.addEventListener("click", () => answerQuestion(index));
    choicesEl.append(button);
  });
}

async function answerQuestion(choiceIndex) {
  const room = controller.room;
  if (!room || room.status !== "playing" || room.answers?.[controller.playerKey]) return;

  const answers = {
    ...(room.answers || {}),
    [controller.playerKey]: choiceIndex
  };

  if (answers.player1 === undefined || answers.player2 === undefined) {
    await controller.update({ answers });
    return;
  }

  const question = QUESTIONS[room.questionIndex];
  const scores = { player1: room.scores?.player1 || 0, player2: room.scores?.player2 || 0 };
  if (answers.player1 === question.answer) scores.player1 += 1;
  if (answers.player2 === question.answer) scores.player2 += 1;

  const nextIndex = room.questionIndex + 1;
  if (nextIndex >= QUESTIONS.length) {
    await controller.update({
      scores,
      answers,
      status: "finished",
      winner: scores.player1 === scores.player2 ? "draw" : scores.player1 > scores.player2 ? "player1" : "player2",
      rematchVotes: { player1: false, player2: false }
    });
    return;
  }

  await controller.update({
    scores,
    questionIndex: nextIndex,
    answers: {},
    currentTurn: "both"
  });
}

function clearQuiz() {
  questionText.textContent = "Create or join a room to begin.";
  choicesEl.innerHTML = "";
  scoreEl.textContent = "Score: you 0 / opponent 0";
  progressEl.textContent = "Question 0 of 5";
}
