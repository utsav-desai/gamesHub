import {
  child,
  get,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { db, isFirebaseConfigured } from "./firebase-config.js";
import { getPlayerId } from "./utils.js";

const ACTIVE_PROFILE_KEY = "minigames.activeProfile";
const PROFILE_THEME_KEY = "minigames.profileTheme";
const PROFILE_NAME_KEY = "minigames.profileName";
const PROFILE_EMOJI_KEY = "minigames.profileEmoji";

export const playerId = getPlayerId();

export function ensureSharedReady() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured yet.");
  }
}

export function getLocalProfile() {
  return {
    id: localStorage.getItem(ACTIVE_PROFILE_KEY) || playerId,
    name: localStorage.getItem(PROFILE_NAME_KEY) || "Me",
    emoji: localStorage.getItem(PROFILE_EMOJI_KEY) || "♡",
    theme: localStorage.getItem(PROFILE_THEME_KEY) || "mint"
  };
}

export function saveLocalProfile(profile) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id || playerId);
  localStorage.setItem(PROFILE_NAME_KEY, profile.name || "Me");
  localStorage.setItem(PROFILE_EMOJI_KEY, profile.emoji || "♡");
  localStorage.setItem(PROFILE_THEME_KEY, profile.theme || "mint");
  document.dispatchEvent(new CustomEvent("profile-theme-changed"));
}

export function subscribe(path, callback, onError = console.error) {
  ensureSharedReady();
  return onValue(ref(db, path), (snapshot) => callback(snapshot.val()), onError);
}

export async function saveProfile(profile) {
  ensureSharedReady();
  const id = profile.id || playerId;
  const cleanProfile = {
    id,
    name: cleanText(profile.name, 32) || "Me",
    emoji: cleanText(profile.emoji, 4) || "♡",
    theme: profile.theme || "mint",
    updatedAt: serverTimestamp()
  };
  await set(ref(db, `couple/profiles/${id}`), cleanProfile);
  saveLocalProfile(cleanProfile);
  return cleanProfile;
}

export async function addReminder(reminder) {
  ensureSharedReady();
  const profile = getLocalProfile();
  const reminderRef = push(ref(db, "couple/reminders"));
  await set(reminderRef, {
    text: cleanText(reminder.text, 140),
    due: reminder.due || "",
    tag: reminder.tag || "Us",
    addedById: profile.id,
    addedByName: profile.name,
    addedByEmoji: profile.emoji,
    done: false,
    createdAt: serverTimestamp()
  });
}

export function updateReminder(id, values) {
  ensureSharedReady();
  return update(ref(db, `couple/reminders/${id}`), values);
}

export function removeReminder(id) {
  ensureSharedReady();
  return remove(ref(db, `couple/reminders/${id}`));
}

export async function addIdea(text) {
  ensureSharedReady();
  const profile = getLocalProfile();
  const ideaRef = push(ref(db, "couple/ideas"));
  await set(ideaRef, {
    text: cleanText(text, 120),
    addedByName: profile.name,
    addedByEmoji: profile.emoji,
    createdAt: serverTimestamp()
  });
}

export async function saveCheckIn(mood, note) {
  ensureSharedReady();
  const profile = getLocalProfile();
  await set(ref(db, `couple/checkins/${profile.id}`), {
    mood,
    note: cleanText(note, 100),
    name: profile.name,
    emoji: profile.emoji,
    updatedAt: serverTimestamp()
  });
}

export function saveSharedNote(text) {
  ensureSharedReady();
  const profile = getLocalProfile();
  return set(ref(db, "couple/sharedNote"), {
    text: cleanText(text, 800),
    updatedByName: profile.name,
    updatedByEmoji: profile.emoji,
    updatedAt: serverTimestamp()
  });
}

export async function readOnce(path) {
  ensureSharedReady();
  return (await get(child(ref(db), path))).val();
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}
