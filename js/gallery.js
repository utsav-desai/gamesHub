import { push, ref as dbRef, remove, serverTimestamp, set } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
import { db, storage } from "./firebase-config.js";
import { getLocalProfile, subscribe } from "./shared-data.js";

const form = document.querySelector("#galleryForm");
const folderInput = document.querySelector("#galleryFolder");
const fileInput = document.querySelector("#galleryFile");
const statusEl = document.querySelector("#galleryStatus");
const galleryEl = document.querySelector("#galleryFolders");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = [...fileInput.files];
  if (!files.length) return;

  try {
    statusEl.textContent = "Uploading...";
    statusEl.classList.remove("error");
    for (const file of files) {
      await uploadGalleryFile(file, folderInput.value);
    }
    form.reset();
    statusEl.textContent = "Uploaded.";
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  }
});

subscribe("couple/gallery", (items) => {
  const grouped = groupByFolder(items || {});
  galleryEl.innerHTML = "";
  Object.entries(grouped).forEach(([folder, entries]) => {
    const section = document.createElement("section");
    section.className = "gallery-folder";
    section.innerHTML = `<h2 class="section-title">${escapeHtml(folder)}</h2><div class="media-grid"></div>`;
    const grid = section.querySelector(".media-grid");
    entries.forEach(([id, item]) => grid.append(renderItem(id, item)));
    galleryEl.append(section);
  });

  if (!Object.keys(grouped).length) {
    galleryEl.innerHTML = "<p class=\"small-note\">No gallery items yet.</p>";
  }
}, showError);

async function uploadGalleryFile(file, folderValue) {
  if (!storage || !db) throw new Error("Firebase is not configured yet.");
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Only photos and videos are supported.");
  }

  const profile = getLocalProfile();
  const folder = cleanFolder(folderValue || "Us");
  const idRef = push(dbRef(db, "couple/gallery"));
  const path = `couple-gallery/${folder}/${idRef.key}-${cleanFileName(file.name)}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const url = await getDownloadURL(fileRef);
  await set(idRef, {
    name: file.name,
    folder,
    path,
    url,
    type: file.type,
    size: file.size,
    addedByName: profile.name,
    addedByEmoji: profile.emoji,
    createdAt: serverTimestamp()
  });
}

function renderItem(id, item) {
  const card = document.createElement("article");
  card.className = "media-card";
  const media = item.type?.startsWith("video/")
    ? `<video src="${item.url}" controls playsinline preload="metadata"></video>`
    : `<img src="${item.url}" alt="${escapeHtml(item.name || "Gallery photo")}">`;
  card.innerHTML = `
    ${media}
    <div>
      <strong>${escapeHtml(item.name || "Untitled")}</strong>
      <small>${escapeHtml(item.addedByEmoji || "♡")} ${escapeHtml(item.addedByName || "Someone")}</small>
    </div>
    <button class="btn warning" type="button">Remove</button>
  `;
  card.querySelector("button").addEventListener("click", async () => {
    try {
      if (item.path && storage) await deleteObject(storageRef(storage, item.path));
      await remove(dbRef(db, `couple/gallery/${id}`));
    } catch (error) {
      showError(error);
    }
  });
  return card;
}

function groupByFolder(items) {
  return Object.entries(items).reduce((groups, entry) => {
    const folder = entry[1].folder || "Us";
    groups[folder] ||= [];
    groups[folder].push(entry);
    return groups;
  }, {});
}

function showError(error) {
  statusEl.textContent = error.message;
  statusEl.classList.add("error");
}

function cleanFolder(value) {
  return String(value || "Us").trim().replace(/[^\w -]/g, "").slice(0, 32) || "Us";
}

function cleanFileName(value) {
  return String(value || "file").replace(/[^\w.-]/g, "-").slice(0, 80);
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
