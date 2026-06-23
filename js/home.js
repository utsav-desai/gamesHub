import { subscribe } from "./shared-data.js";

const randomWrap = document.querySelector("#randomGalleryPhoto");

subscribe("couple/gallery", (items) => {
  const photos = Object.values(items || {}).filter((item) => item.type?.startsWith("image/") && item.url);
  if (!photos.length) {
    randomWrap.innerHTML = "<p class=\"small-note\">Add photos to the gallery and one will appear here.</p>";
    return;
  }

  const photo = photos[Math.floor(Math.random() * photos.length)];
  randomWrap.innerHTML = `
    <img src="${photo.url}" alt="${escapeHtml(photo.name || "Gallery photo")}">
    <div>
      <strong>${escapeHtml(photo.folder || "Gallery")}</strong>
      <small>${escapeHtml(photo.addedByName || "Someone")}</small>
    </div>
  `;
}, () => {
  randomWrap.innerHTML = "<p class=\"small-note\">Gallery preview will appear after Firebase is ready.</p>";
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}
