import { onValue, push, ref, remove, serverTimestamp, set } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { db } from "./firebase-config.js";
import { getLocalProfile } from "./shared-data.js";

const canvas = document.querySelector("#drawingCanvas");
const ctx = canvas.getContext("2d");
const colorInput = document.querySelector("#brushColor");
const sizeInput = document.querySelector("#brushSize");
const clearBtn = document.querySelector("#clearDrawingBtn");
const statusEl = document.querySelector("#drawingStatus");

let drawing = false;
let currentStroke = null;
let strokes = {};

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("pointerdown", startStroke);
canvas.addEventListener("pointermove", moveStroke);
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);
canvas.addEventListener("pointerleave", endStroke);
clearBtn.addEventListener("click", clearDrawing);

if (db) {
  onValue(ref(db, "couple/drawing/strokes"), (snapshot) => {
    strokes = snapshot.val() || {};
    redraw();
  }, (error) => {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  });
}

function startStroke(event) {
  drawing = true;
  canvas.setPointerCapture(event.pointerId);
  const profile = getLocalProfile();
  currentStroke = {
    color: colorInput.value,
    size: Number(sizeInput.value),
    name: profile.name,
    emoji: profile.emoji,
    points: [getPoint(event)]
  };
  event.preventDefault();
}

function moveStroke(event) {
  if (!drawing || !currentStroke) return;
  currentStroke.points.push(getPoint(event));
  redraw();
  drawStroke(currentStroke);
  event.preventDefault();
}

async function endStroke(event) {
  if (!drawing || !currentStroke) return;
  drawing = false;
  currentStroke.points.push(getPoint(event));
  try {
    const strokeRef = push(ref(db, "couple/drawing/strokes"));
    await set(strokeRef, {
      ...currentStroke,
      createdAt: serverTimestamp()
    });
    statusEl.textContent = "Stroke shared.";
    statusEl.classList.remove("error");
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  }
  currentStroke = null;
}

async function clearDrawing() {
  try {
    await remove(ref(db, "couple/drawing/strokes"));
    statusEl.textContent = "Canvas cleared.";
    statusEl.classList.remove("error");
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  redraw();
}

function redraw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  Object.values(strokes).forEach(drawStroke);
}

function drawStroke(stroke) {
  if (!stroke.points?.length) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color || "#0f8b8d";
  ctx.beginPath();
  stroke.points.forEach((point, index) => {
    const width = Math.max(1, (stroke.size || 6) * (point.pressure || 0.65));
    ctx.lineWidth = width;
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    pressure: event.pressure || 0.65
  };
}
