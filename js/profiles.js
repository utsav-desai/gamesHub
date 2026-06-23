import { getLocalProfile, playerId, saveLocalProfile, saveProfile, subscribe } from "./shared-data.js";

const form = document.querySelector("#profileForm");
const nameInput = document.querySelector("#profileName");
const emojiInput = document.querySelector("#profileEmoji");
const themeInput = document.querySelector("#profileTheme");
const statusEl = document.querySelector("#profileStatus");
const profileList = document.querySelector("#profileList");

const localProfile = getLocalProfile();
nameInput.value = localProfile.name;
emojiInput.value = localProfile.emoji;
themeInput.value = localProfile.theme;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const profile = await saveProfile({
      id: playerId,
      name: nameInput.value,
      emoji: emojiInput.value,
      theme: themeInput.value
    });
    statusEl.textContent = `Saved ${profile.emoji} ${profile.name}.`;
    statusEl.classList.remove("error");
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  }
});

themeInput.addEventListener("change", () => {
  saveLocalProfile({ ...getLocalProfile(), theme: themeInput.value });
});

subscribe("couple/profiles", (profiles) => {
  profileList.innerHTML = "";
  Object.values(profiles || {}).forEach((profile) => {
    const item = document.createElement("button");
    item.className = "profile-card";
    item.type = "button";
    item.innerHTML = `<span>${profile.emoji || "♡"}</span><strong>${profile.name || "Me"}</strong><small>${profile.theme || "mint"}</small>`;
    item.addEventListener("click", () => {
      saveLocalProfile(profile);
      nameInput.value = profile.name || "";
      emojiInput.value = profile.emoji || "";
      themeInput.value = profile.theme || "mint";
      statusEl.textContent = `Using ${profile.emoji || "♡"} ${profile.name || "Me"} on this device.`;
      statusEl.classList.remove("error");
    });
    profileList.append(item);
  });
}, (error) => {
  statusEl.textContent = error.message;
  statusEl.classList.add("error");
});
