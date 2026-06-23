/* ==========================================================================
   STORAGE.JS
   Centralized localStorage utility for the whole app.
   Every other module reads and writes app data through this file only,
   so there is a single place that knows about the localStorage key and
   the shape of the data we save.
   ========================================================================== */

const FocusBeatStorage = (function () {

  // This is the only key we ever write to localStorage.
  const STORAGE_KEY = "focusbeat_data";

  // The shape of a brand new install, before the user has done anything.
  function getDefaultData() {
    return {
      tasks: [],
      sessions: [], // { id, date, duration, mode, completed }
      settings: {
        theme: "dark",
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        masterVolume: 70
      },
      streak: {
        current: 0,
        longest: 0,
        lastActiveDate: null // "YYYY-MM-DD" string of the last day a session was completed
      },
      timerState: {
        mode: "focus",
        secondsLeft: 25 * 60,
        isRunning: false,
        sessionsCompletedToday: 0
      }
    };
  }

  // Reads the full data object from localStorage.
  // Falls back to default data if nothing is saved yet, or if the saved
  // data is corrupted somehow.
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return getDefaultData();
      }

      const parsed = JSON.parse(raw);

      // Merge with defaults so older saves still work if we add new fields later.
      const defaults = getDefaultData();
      return {
        tasks: parsed.tasks || defaults.tasks,
        sessions: parsed.sessions || defaults.sessions,
        settings: Object.assign({}, defaults.settings, parsed.settings),
        streak: Object.assign({}, defaults.streak, parsed.streak),
        timerState: Object.assign({}, defaults.timerState, parsed.timerState)
      };
    } catch (error) {
      console.warn("FocusBeat: could not read saved data, starting fresh.", error);
      return getDefaultData();
    }
  }

  // Writes the full data object back to localStorage.
  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("FocusBeat: could not save data.", error);
    }
  }

  // Turns a Date object into a simple "YYYY-MM-DD" string using local time.
  // Used everywhere we need to compare "which day did this happen on"
  // without timezone surprises from toISOString().
  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Public API of the storage module.
  return {
    load: loadData,
    save: saveData,
    getDefaultData: getDefaultData,
    getDateKey: getDateKey
  };

})();