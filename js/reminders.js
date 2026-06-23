import { addReminder, removeReminder, subscribe, updateReminder } from "./shared-data.js";

const form = document.querySelector("#reminderForm");
const textInput = document.querySelector("#reminderText");
const dueInput = document.querySelector("#reminderDue");
const tagInput = document.querySelector("#reminderTag");
const statusEl = document.querySelector("#reminderStatus");
const list = document.querySelector("#reminderList");
const empty = document.querySelector("#emptyReminders");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await addReminder({
      text: textInput.value,
      due: dueInput.value,
      tag: tagInput.value
    });
    form.reset();
    statusEl.textContent = "Reminder added.";
    statusEl.classList.remove("error");
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  }
});

subscribe("couple/reminders", (reminders) => {
  const items = Object.entries(reminders || {}).sort(([, a], [, b]) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return String(a.due || "9999").localeCompare(String(b.due || "9999"));
  });
  empty.hidden = items.length > 0;
  list.innerHTML = "";
  items.forEach(([id, reminder]) => list.append(renderReminder(id, reminder)));
}, (error) => {
  statusEl.textContent = error.message;
  statusEl.classList.add("error");
});

function renderReminder(id, reminder) {
  const item = document.createElement("article");
  item.className = "reminder-item";
  item.classList.toggle("done", Boolean(reminder.done));
  item.innerHTML = `
    <div>
      <strong>${escapeHtml(reminder.text || "")}</strong>
      <p>${reminder.due ? `Due ${escapeHtml(reminder.due)}` : "No date"} · ${escapeHtml(reminder.tag || "Us")}</p>
      <small>Added by ${escapeHtml(reminder.addedByEmoji || "♡")} ${escapeHtml(reminder.addedByName || "Someone")}</small>
    </div>
    <div class="button-row">
      <button class="btn" type="button" data-action="toggle">${reminder.done ? "Undo" : "Done"}</button>
      <button class="btn warning" type="button" data-action="delete">Delete</button>
    </div>
  `;
  item.querySelector('[data-action="toggle"]').addEventListener("click", () => updateReminder(id, { done: !reminder.done }));
  item.querySelector('[data-action="delete"]').addEventListener("click", () => removeReminder(id));
  return item;
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
