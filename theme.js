// Theme Toggle Functionality
(function() {
  'use strict';

  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.querySelector(".theme-toggle-icon");
  const themeText = document.querySelector(".theme-toggle-text");

  // Check for saved theme preference or default to light theme
  const currentTheme = localStorage.getItem("theme") || "light";

  // Apply light theme by default
  document.body.classList.add("light-theme");

  // If user previously selected dark theme, switch to it
  if (currentTheme === "dark") {
    document.body.classList.remove("light-theme");
    themeIcon.textContent = "🌙";
    themeText.textContent = "Dark";
  }

  // Theme toggle click handler
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");

    if (document.body.classList.contains("light-theme")) {
      themeIcon.textContent = "☀️";
      themeText.textContent = "Light";
      localStorage.setItem("theme", "light");
    } else {
      themeIcon.textContent = "🌙";
      themeText.textContent = "Dark";
      localStorage.setItem("theme", "dark");
    }

    // Trigger custom event for pages that need to react to theme changes
    const themeChangeEvent = new CustomEvent('themeChanged', {
      detail: { isDark: !document.body.classList.contains("light-theme") }
    });
    document.dispatchEvent(themeChangeEvent);
  });
})();
