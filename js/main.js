/* ==========================================================================
   MAIN.JS
   The entry point of the app. Loads the saved data once, then hands a
   shared reference to every feature module so they all read/write the
   same object. Also owns the things that don't belong to one single
   feature: page navigation, the mobile sidebar, theme switching, the
   toast notification system, and the button ripple effect.
   ========================================================================== */

// Small toast helper other modules can call to show a brief notification.
// Defined on window so any script loaded before this one can still use it
// at runtime (by the time a user clicks anything, every script has loaded).
window.FocusBeatToast = {
  show: function (message) {
    const toastArea = document.getElementById("toastArea");

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastArea.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("leaving");
      setTimeout(() => toast.remove(), 300);
    }, 2600);
  }
};

document.addEventListener("DOMContentLoaded", function () {

  // -------------------- Load shared data and start every module --------------------

  const appData = FocusBeatStorage.load();

  FocusBeatTimer.init(appData);
  FocusBeatSounds.init(appData);
  FocusBeatTasks.init(appData);
  FocusBeatAnalytics.init(appData);

  setupPageNavigation();
  setupMobileSidebar();
  setupThemeToggle(appData);
  setupRippleEffect();

  // -------------------- Page navigation (Timer / Sounds / Tasks / Analytics) -------------------

  function setupPageNavigation() {
    const menuButtons = document.querySelectorAll(".menu-btn");
    const pages = document.querySelectorAll(".page");

    menuButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetPageId = button.dataset.page;

        menuButtons.forEach((b) => b.classList.toggle("active", b === button));
        pages.forEach((page) => page.classList.toggle("active", page.id === targetPageId));

        closeMobileSidebar();
      });
    });
  }

  // -------------------- Mobile sidebar (hamburger menu) --------------------

  function setupMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const hamburgerBtn = document.getElementById("hamburgerBtn");

    hamburgerBtn.addEventListener("click", () => {
      sidebar.classList.add("open");
      overlay.classList.add("active");
    });

    overlay.addEventListener("click", closeMobileSidebar);
  }

  function closeMobileSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("active");
  }

  // -------------------- Theme toggle (dark / light) --------------------

  function setupThemeToggle(appData) {
    const themeButton = document.getElementById("themeButton");
    const themeButtonMobile = document.getElementById("themeButtonMobile");
    const themeIcon = document.getElementById("themeIcon");

    applyTheme(appData.settings.theme);

    function toggleTheme() {
      const newTheme = appData.settings.theme === "dark" ? "light" : "dark";
      appData.settings.theme = newTheme;
      FocusBeatStorage.save(appData);
      applyTheme(newTheme);
    }

    function applyTheme(theme) {
  // 1. Toggle the theme class
  document.body.classList.toggle("light-theme", theme === "light");
  
  const icon = theme === "dark" 
    ? `<img src="assests/dark-mode-white.svg" alt="Dark Mode Icon" width="25" height="25">` 
    : `<img src="assests/dark-mode.svg" alt="Light Mode Icon" width="25" height="25">`;
  
  // 3. Use innerHTML to actually render the image, NOT textContent
  themeIcon.innerHTML = icon;
  
  // Assuming themeButtonMobile is defined elsewhere, update it too
  if (themeButtonMobile) {
      themeButtonMobile.innerHTML = icon; 
  }
  
  // 4. Update the text label
  themeButton.querySelector("span:last-child").textContent =
    theme === "dark" ? "Dark Mode" : "Light Mode";
}

    themeButton.addEventListener("click", toggleTheme);
    themeButtonMobile.addEventListener("click", toggleTheme);
  }

  // -------------------- Button ripple effect --------------------
  // Adds a little expanding circle wherever the user clicks one of the
  // main action buttons, purely as a visual touch.

  function setupRippleEffect() {
    const rippleTargets = ".start-btn, .add-task-btn, .save-btn, .icon-btn, .mode-btn";

    document.addEventListener("click", (event) => {
      const button = event.target.closest(rippleTargets);
      if (!button) return;

      const bounds = button.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(bounds.width, bounds.height);

      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - bounds.left - size / 2}px`;
      ripple.style.top = `${event.clientY - bounds.top - size / 2}px`;

      button.style.position = button.style.position || "relative";
      button.appendChild(ripple);

      setTimeout(() => ripple.remove(), 550);
    });
  }

});