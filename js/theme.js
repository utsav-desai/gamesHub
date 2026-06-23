const THEME_KEY = "minigames.theme";

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.profileTheme = localStorage.getItem("minigames.profileTheme") || "mint";
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.textContent = theme === "dark" ? "Light" : "Dark";
    button.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
  });
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

applyTheme(getPreferredTheme());

document.addEventListener("DOMContentLoaded", () => {
  injectNavigation();
  applyTheme(getPreferredTheme());
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", toggleTheme);
  });
});

document.addEventListener("profile-theme-changed", () => applyTheme(getPreferredTheme()));

function injectNavigation() {
  const header = document.querySelector(".site-header");
  if (!header || header.querySelector(".site-nav")) return;

  const isGamePage = location.pathname.includes("/games/");
  const prefix = isGamePage ? "../" : "";
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "Main navigation");
  nav.innerHTML = `
    <a href="${prefix}index.html">Games</a>
    <a href="${prefix}profiles.html">Profiles</a>
    <a href="${prefix}reminders.html">Reminders</a>
    <a href="${prefix}together.html">Together</a>
    <a href="${prefix}drawing.html">Drawing</a>
  `;
  [...nav.querySelectorAll("a")].forEach((link) => {
    const linkPath = new URL(link.getAttribute("href"), location.href).pathname;
    if (
      linkPath === location.pathname ||
      (location.pathname === "/" && link.textContent === "Games") ||
      (location.pathname.includes("/games/") && link.textContent === "Games")
    ) {
      link.classList.add("active");
    }
  });
  const toggle = header.querySelector("[data-theme-toggle]");
  header.insertBefore(nav, toggle || null);
}
