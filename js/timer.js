/* ==========================================================================
   TIMER.JS
   Handles the Pomodoro timer: switching modes, starting/pausing/resuming,
   resetting, skipping, drawing the progress ring, and saving a session
   record whenever a Focus session finishes.
   ========================================================================== */

const FocusBeatTimer = (function () {

  // Circumference of the progress ring circle (radius is 96, see components.css).
  const RING_CIRCUMFERENCE = 2 * Math.PI * 96;

  // How many Focus sessions make up one "set" before the dots reset.
  const SESSIONS_PER_SET = 4;

  let appData = null; // shared reference to the data object loaded from storage
  let intervalId = null;
  let currentMode = "focus";
  let secondsLeft = 0;
  let totalSecondsForMode = 0;
  let isRunning = false;

  // Cached DOM elements, filled in during init().
  let elements = {};

  function getModeDurationSeconds(mode) {
    if (mode === "focus") return appData.settings.focusMinutes * 60;
    if (mode === "short") return appData.settings.shortBreakMinutes * 60;
    return appData.settings.longBreakMinutes * 60;
  }

  function getModeLabel(mode) {
    if (mode === "focus") return "Focus Time";
    if (mode === "short") return "Short Break";
    return "Long Break";
  }

  // -------------------- Rendering --------------------

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function updateDisplay() {
    elements.timerDisplay.textContent = formatTime(secondsLeft);
    elements.timerModeText.textContent = getModeLabel(currentMode);

    const progressFraction = secondsLeft / totalSecondsForMode;
    const offset = RING_CIRCUMFERENCE * (1 - progressFraction);
    elements.progressRing.style.strokeDashoffset = offset;

    elements.startButton.textContent = isRunning ? "⏸ Pause" : "▶ Start";
    elements.ringContainer.classList.toggle("is-running", isRunning);
  }

  function renderSessionDots() {
    const dotsCompleted = appData.timerState.sessionsCompletedToday % SESSIONS_PER_SET;
    elements.sessionDots.innerHTML = "";

    for (let i = 0; i < SESSIONS_PER_SET; i++) {
      const dot = document.createElement("div");
      dot.className = "session-dot" + (i < dotsCompleted ? " filled" : "");
      elements.sessionDots.appendChild(dot);
    }
  }

  function setActiveModeButton(mode) {
    elements.modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
  }

  // -------------------- Mode switching --------------------

  function switchMode(mode, options) {
    options = options || {};
    pauseTimer();

    currentMode = mode;
    totalSecondsForMode = getModeDurationSeconds(mode);
    secondsLeft = options.keepSecondsLeft ? secondsLeft : totalSecondsForMode;

    setActiveModeButton(mode);
    updateDisplay();
    saveTimerState();
  }

  // -------------------- Start / pause / resume / reset / skip --------------------

  function startTimer() {
    if (isRunning) return;
    isRunning = true;

    intervalId = setInterval(() => {
      secondsLeft -= 1;

      if (secondsLeft <= 0) {
        completeCurrentMode();
        return;
      }

      updateDisplay();
      saveTimerState();
    }, 1000);

    updateDisplay();
  }

  function pauseTimer() {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    updateDisplay();
    saveTimerState();
  }

  function toggleStartPause() {
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  function resetTimer() {
    pauseTimer();
    secondsLeft = totalSecondsForMode;
    updateDisplay();
    saveTimerState();
  }

  function skipToNext() {
    pauseTimer();
    const nextMode = getNextMode();
    switchMode(nextMode);
  }

  function getNextMode() {
    if (currentMode !== "focus") {
      return "focus";
    }
    const dotsCompleted = (appData.timerState.sessionsCompletedToday + 1) % SESSIONS_PER_SET;
    return dotsCompleted === 0 ? "long" : "short";
  }

  // -------------------- Completion handling --------------------

  function completeCurrentMode() {
    pauseTimer();
    playCompletionSound();

    if (currentMode === "focus") {
      recordFinishedSession();
    }

    showCompletionPopup();

    const nextMode = getNextMode();
    switchMode(nextMode);
  }

  function recordFinishedSession() {
    const now = new Date();
    const session = {
      id: Date.now(),
      date: FocusBeatStorage.getDateKey(now),
      duration: appData.settings.focusMinutes,
      completed: true
    };

    appData.sessions.push(session);
    appData.timerState.sessionsCompletedToday += 1;
    updateStreak(now);

    FocusBeatStorage.save(appData);
    renderSessionDots();

    document.dispatchEvent(new CustomEvent("focusbeat:dataChanged"));
    window.FocusBeatToast.show("Focus session saved");
  }

  function updateStreak(now) {
    const todayKey = FocusBeatStorage.getDateKey(now);
    const streak = appData.streak;

    if (streak.lastActiveDate === todayKey) {
      // Already counted a session today, streak day already secured.
      return;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = FocusBeatStorage.getDateKey(yesterday);

    if (streak.lastActiveDate === yesterdayKey) {
      streak.current += 1; // continued an existing streak
    } else {
      streak.current = 1; // streak was broken, start a new one
    }

    streak.longest = Math.max(streak.longest, streak.current);
    streak.lastActiveDate = todayKey;
  }

  function showCompletionPopup() {
    const popup = document.getElementById("completionPopup");
    const emoji = document.getElementById("completionEmoji");
    const heading = document.getElementById("completionHeading");
    const text = document.getElementById("completionText");

    if (currentMode === "focus") {
      emoji.textContent = "🎉";
      heading.textContent = "Session Complete!";
      text.textContent = "Great work! Time for a well-earned break.";
    } else {
      emoji.textContent = "💪";
      heading.textContent = "Break's Over!";
      text.textContent = "Ready to get back into focus mode?";
    }

    popup.classList.remove("hidden");
  }

  // A short three-beep chime built with the Web Audio API, so no audio
  // file needs to be downloaded or shipped with the project.
  function playCompletionSound() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();

      [0, 0.25, 0.5].forEach((startDelay) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 740;
        gainNode.gain.value = 0.001;

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const startTime = audioContext.currentTime + startDelay;
        gainNode.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.22);
      });
    } catch (error) {
      console.warn("FocusBeat: could not play completion sound.", error);
    }
  }

  // -------------------- Persistence --------------------

  function saveTimerState() {
    appData.timerState.mode = currentMode;
    appData.timerState.secondsLeft = secondsLeft;
    appData.timerState.isRunning = isRunning;
    FocusBeatStorage.save(appData);
  }

  // -------------------- Init --------------------

  function cacheElements() {
    elements = {
      timerDisplay: document.getElementById("timerDisplay"),
      timerModeText: document.getElementById("timerModeText"),
      progressRing: document.getElementById("progressRing"),
      ringContainer: document.querySelector(".ring-container"),
      startButton: document.getElementById("startButton"),
      resetButton: document.getElementById("resetButton"),
      skipButton: document.getElementById("skipButton"),
      sessionDots: document.getElementById("sessionDots"),
      modeButtons: Array.from(document.querySelectorAll(".mode-btn"))
    };
  }

  function bindEvents() {
    elements.startButton.addEventListener("click", toggleStartPause);
    elements.resetButton.addEventListener("click", resetTimer);
    elements.skipButton.addEventListener("click", skipToNext);

    elements.modeButtons.forEach((button) => {
      button.addEventListener("click", () => switchMode(button.dataset.mode));
    });

    document.getElementById("dismissCompletionBtn").addEventListener("click", () => {
      document.getElementById("completionPopup").classList.add("hidden");
    });
  }

  function resetDailyCounterIfNewDay() {
    const todayKey = FocusBeatStorage.getDateKey(new Date());
    const lastSavedKey = appData.timerState.lastSavedDateKey;

    if (lastSavedKey && lastSavedKey !== todayKey) {
      appData.timerState.sessionsCompletedToday = 0;
    }
    appData.timerState.lastSavedDateKey = todayKey;
  }

  function init(sharedData) {
    appData = sharedData;
    cacheElements();
    bindEvents();

    resetDailyCounterIfNewDay();

    currentMode = appData.timerState.mode || "focus";
    totalSecondsForMode = getModeDurationSeconds(currentMode);
    secondsLeft = appData.timerState.secondsLeft || totalSecondsForMode;
    isRunning = false; // never auto-resume a running countdown after a page reload

    setActiveModeButton(currentMode);
    updateDisplay();
    renderSessionDots();
    saveTimerState();
  }

  return { init: init };

})();