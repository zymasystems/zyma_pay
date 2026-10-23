(() => {
  "use strict";
  const KEY = "zyma-pay-theme";
  const root = document.documentElement;
  const readTheme = () => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch (_) {}
    return "dark";
  };
  const paintButtons = () => {
    const selected = root.dataset.theme === "light" ? "light" : "dark";
    document.querySelectorAll("#themeToggle, .theme-toggle-button, [data-theme-toggle]").forEach((button) => {
      button.innerHTML = selected === "dark"
        ? '<span aria-hidden="true">☼</span><span class="theme-button-label">Light mode</span>'
        : '<span aria-hidden="true">☾</span><span class="theme-button-label">Dark mode</span>';
      button.setAttribute("aria-label", selected === "dark" ? "Switch to light mode" : "Switch to dark mode");
      button.setAttribute("aria-pressed", selected === "light" ? "true" : "false");
      button.title = selected === "dark" ? "Switch to light mode" : "Switch to dark mode";
    });
  };
  const applyTheme = (theme, persist = false) => {
    const selected = theme === "light" ? "light" : "dark";
    root.dataset.theme = selected;
    root.style.colorScheme = selected;
    if (persist) {
      try { localStorage.setItem(KEY, selected); } catch (_) {}
    }
    paintButtons();
  };
  const bindButton = (button) => {
    if (button.dataset.themeBound === "true") return;
    button.dataset.themeBound = "true";
    button.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
  };
  const mount = () => {
    let button = document.getElementById("themeToggle");
    const host = document.querySelector(".topbar-actions, .invoice-topbar-actions");
    if (!button && host) {
      button = document.createElement("button");
      button.type = "button";
      button.id = "themeToggle";
      button.className = "theme-toggle-button";
      host.appendChild(button);
    }
    document.querySelectorAll("#themeToggle, .theme-toggle-button, [data-theme-toggle]").forEach(bindButton);
    paintButtons();
  };
  applyTheme(readTheme());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
  window.addEventListener("storage", (event) => {
    if (event.key === KEY && (event.newValue === "light" || event.newValue === "dark")) applyTheme(event.newValue);
  });
})();
