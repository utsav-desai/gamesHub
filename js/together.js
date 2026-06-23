import { addIdea, saveCheckIn, saveSharedNote, subscribe } from "./shared-data.js";

const ideaForm = document.querySelector("#ideaForm");
const ideaInput = document.querySelector("#ideaText");
const ideaList = document.querySelector("#ideaList");
const moodForm = document.querySelector("#moodForm");
const moodInput = document.querySelector("#moodSelect");
const moodNote = document.querySelector("#moodNote");
const checkinList = document.querySelector("#checkinList");
const noteText = document.querySelector("#sharedNoteText");
const noteBtn = document.querySelector("#saveNoteBtn");
const noteMeta = document.querySelector("#noteMeta");
const statusEl = document.querySelector("#togetherStatus");

ideaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await addIdea(ideaInput.value);
    ideaForm.reset();
    statusEl.textContent = "Idea added.";
    statusEl.classList.remove("error");
  } catch (error) {
    showError(error);
  }
});

moodForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveCheckIn(moodInput.value, moodNote.value);
    moodNote.value = "";
    statusEl.textContent = "Check-in saved.";
    statusEl.classList.remove("error");
  } catch (error) {
    showError(error);
  }
});

noteBtn.addEventListener("click", async () => {
  try {
    await saveSharedNote(noteText.value);
    statusEl.textContent = "Shared note saved.";
    statusEl.classList.remove("error");
  } catch (error) {
    showError(error);
  }
});

subscribe("couple/ideas", (ideas) => {
  ideaList.innerHTML = "";
  Object.values(ideas || {}).reverse().slice(0, 12).forEach((idea) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${escapeHtml(idea.text || "")}</strong><small>${escapeHtml(idea.addedByEmoji || "♡")} ${escapeHtml(idea.addedByName || "Someone")}</small>`;
    ideaList.append(item);
  });
});

subscribe("couple/checkins", (checkins) => {
  checkinList.innerHTML = "";
  Object.values(checkins || {}).forEach((checkin) => {
    const item = document.createElement("article");
    item.className = "mini-card";
    item.innerHTML = `<strong>${escapeHtml(checkin.emoji || "♡")} ${escapeHtml(checkin.name || "Someone")}</strong><p>${escapeHtml(checkin.mood || "Okay")}</p><small>${escapeHtml(checkin.note || "")}</small>`;
    checkinList.append(item);
  });
});

subscribe("couple/sharedNote", (note) => {
  if (!note) return;
  if (document.activeElement !== noteText) noteText.value = note.text || "";
  noteMeta.textContent = `Last edited by ${note.updatedByEmoji || "♡"} ${note.updatedByName || "Someone"}`;
});

function showError(error) {
  statusEl.textContent = error.message;
  statusEl.classList.add("error");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}
