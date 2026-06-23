/* ==========================================================================
   ANALYTICS.JS
   Turns the raw tasks/sessions/streak data into everything the user sees:
   the Focus Score card and streak card on the Timer page, and the full
   Analytics dashboard (summary numbers, weekly bar chart, 28-day heatmap,
   and the score breakdown). Nothing here is stored directly - it is all
   calculated on the fly from appData each time render() runs.
   ========================================================================== */

const FocusBeatAnalytics = (function () {

  // Score needed to reach each productivity level.
  const LEVELS = [
    { name: "Beginner", minScore: 0 },
    { name: "Focused", minScore: 50 },
    { name: "Productive", minScore: 150 },
    { name: "Deep Work", minScore: 300 },
    { name: "Master", minScore: 500 }
  ];

  let appData = null;
  let elements = {};
  let previousStreakValue = 0;

  // -------------------- Calculations --------------------

  function getCompletedSessions() {
    return appData.sessions.filter((session) => session.completed);
  }

  function getCompletedTasksCount() {
    return appData.tasks.filter((task) => task.completed).length;
  }

  function getTotalFocusMinutes() {
    return getCompletedSessions().reduce((sum, session) => sum + session.duration, 0);
  }

  function calculateFocusScore() {
    const sessionPoints = getCompletedSessions().length * 10;
    const taskPoints = getCompletedTasksCount() * 5;
    const streakPoints = appData.streak.current * 20;

    return {
      total: sessionPoints + taskPoints + streakPoints,
      sessionPoints,
      taskPoints,
      streakPoints
    };
  }

  function getLevelForScore(score) {
    let currentLevel = LEVELS[0];
    for (const level of LEVELS) {
      if (score >= level.minScore) {
        currentLevel = level;
      }
    }
    return currentLevel;
  }

  function getProgressWithinLevel(score, level) {
    const levelIndex = LEVELS.indexOf(level);
    const nextLevel = LEVELS[levelIndex + 1];

    if (!nextLevel) return 100; // already at the highest level

    const range = nextLevel.minScore - level.minScore;
    const progress = score - level.minScore;
    return Math.min(100, Math.round((progress / range) * 100));
  }

  function countSessionsOnDate(dateKey) {
    return getCompletedSessions().filter((session) => session.date === dateKey).length;
  }

  // -------------------- Rendering: Timer page score & streak cards --------------------

  function renderScoreCard() {
    const score = calculateFocusScore();
    const level = getLevelForScore(score.total);
    const progress = getProgressWithinLevel(score.total, level);

    elements.scoreNumber.textContent = score.total;
    elements.levelBadge.textContent = level.name;
    elements.scoreProgressBar.style.width = `${progress}%`;
  }

  function renderStreakCard() {
    const streak = appData.streak;

    elements.streakCount.textContent = streak.current;
    elements.streakBest.textContent = streak.longest;

    if (streak.current === 0) {
      elements.streakMessage.textContent = "Start your first session!";
    } else if (streak.current < 3) {
      elements.streakMessage.textContent = "Nice start, keep it going!";
    } else if (streak.current < 7) {
      elements.streakMessage.textContent = "You're building real momentum.";
    } else {
      elements.streakMessage.textContent = "Incredible consistency!";
    }

    // Play a small celebration animation only when the streak just went up.
    if (streak.current > previousStreakValue) {
      elements.streakFire.classList.remove("celebrating");
      // Forces the browser to restart the animation if it's already mid-play.
      void elements.streakFire.offsetWidth;
      elements.streakFire.classList.add("celebrating");
    }
    previousStreakValue = streak.current;
  }

  function renderTodayCard() {
    const todayKey = FocusBeatStorage.getDateKey(new Date());
    const todaySessions = countSessionsOnDate(todayKey);
    const todayMinutes = todaySessions * appData.settings.focusMinutes;

    elements.todaySessionCount.textContent = todaySessions;
    elements.todayMinuteCount.textContent = todayMinutes;
    elements.allTimeSessionCount.textContent = getCompletedSessions().length;
  }

  // -------------------- Rendering: Analytics dashboard --------------------

  function renderSummaryBoxes() {
    elements.analyticsTime.textContent = `${getTotalFocusMinutes()}m`;
    elements.analyticsSessions.textContent = getCompletedSessions().length;
    elements.analyticsTasks.textContent = getCompletedTasksCount();
    elements.analyticsStreak.textContent = appData.streak.current;
  }

  function renderWeeklyBarChart() {
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const last7Days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push({
        dateKey: FocusBeatStorage.getDateKey(date),
        label: dayLabels[date.getDay()],
        count: countSessionsOnDate(FocusBeatStorage.getDateKey(date))
      });
    }

    const maxCount = Math.max(1, ...last7Days.map((day) => day.count));

    elements.weeklyBarChart.innerHTML = "";
    last7Days.forEach((day) => {
      const heightPercent = (day.count / maxCount) * 100;

      const column = document.createElement("div");
      column.className = "bar-column";
      column.innerHTML = `
        <span class="bar-value-label">${day.count}</span>
        <div class="bar-fill" style="height: ${heightPercent}%"></div>
        <span class="bar-day-label">${day.label}</span>
      `;
      elements.weeklyBarChart.appendChild(column);
    });
  }

  function renderHeatmap() {
    elements.activityHeatmap.innerHTML = "";

    for (let i = 27; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const count = countSessionsOnDate(FocusBeatStorage.getDateKey(date));

      let level = 0;
      if (count >= 7) level = 4;
      else if (count >= 5) level = 3;
      else if (count >= 3) level = 2;
      else if (count >= 1) level = 1;

      const cell = document.createElement("div");
      cell.className = `heatmap-cell level-${level}`;
      cell.title = `${date.toLocaleDateString()}: ${count} session${count === 1 ? "" : "s"}`;
      elements.activityHeatmap.appendChild(cell);
    }
  }

  function renderScoreBreakdown() {
    const score = calculateFocusScore();
    const level = getLevelForScore(score.total);
    const progress = getProgressWithinLevel(score.total, level);

    elements.analyticsBigScore.textContent = score.total;
    elements.analyticsLevel.textContent = level.name;
    elements.formulaSessions.textContent = `+${score.sessionPoints}`;
    elements.formulaTasks.textContent = `+${score.taskPoints}`;
    elements.formulaStreak.textContent = `+${score.streakPoints}`;
    elements.analyticsScoreBar.style.width = `${progress}%`;
  }

  // -------------------- Public render --------------------

  function renderAll() {
    renderScoreCard();
    renderStreakCard();
    renderTodayCard();
    renderSummaryBoxes();
    renderWeeklyBarChart();
    renderHeatmap();
    renderScoreBreakdown();
  }

  // -------------------- Init --------------------

  function cacheElements() {
    elements = {
      scoreNumber: document.getElementById("scoreNumber"),
      levelBadge: document.getElementById("levelBadge"),
      scoreProgressBar: document.getElementById("scoreProgressBar"),
      streakFire: document.getElementById("streakFire"),
      streakCount: document.getElementById("streakCount"),
      streakBest: document.getElementById("streakBest"),
      streakMessage: document.getElementById("streakMessage"),
      todaySessionCount: document.getElementById("todaySessionCount"),
      todayMinuteCount: document.getElementById("todayMinuteCount"),
      allTimeSessionCount: document.getElementById("allTimeSessionCount"),
      analyticsTime: document.getElementById("analyticsTime"),
      analyticsSessions: document.getElementById("analyticsSessions"),
      analyticsTasks: document.getElementById("analyticsTasks"),
      analyticsStreak: document.getElementById("analyticsStreak"),
      weeklyBarChart: document.getElementById("weeklyBarChart"),
      activityHeatmap: document.getElementById("activityHeatmap"),
      analyticsBigScore: document.getElementById("analyticsBigScore"),
      analyticsLevel: document.getElementById("analyticsLevel"),
      formulaSessions: document.getElementById("formulaSessions"),
      formulaTasks: document.getElementById("formulaTasks"),
      formulaStreak: document.getElementById("formulaStreak"),
      analyticsScoreBar: document.getElementById("analyticsScoreBar")
    };
  }

  function init(sharedData) {
    appData = sharedData;
    previousStreakValue = appData.streak.current;
    cacheElements();
    renderAll();

    // Re-render automatically whenever any other module changes
    // tasks, sessions or streak data.
    document.addEventListener("focusbeat:dataChanged", renderAll);
  }

  return { init: init };

})();