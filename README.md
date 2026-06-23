# FocusBeat — Ambient Soundboard & Pomodoro Tracker for Developers

A complete, frontend-only productivity app: a Pomodoro timer, an ambient
soundboard, a task manager, and an analytics dashboard with a focus-score
and streak system. Built with **plain HTML, CSS, and vanilla JavaScript
(ES6+) only** — no frameworks, no build step, no backend. Every piece of
data is saved to and loaded from the browser's `localStorage`.

---

## Table of contents

1. [Folder structure](#folder-structure)
2. [Getting started](#getting-started)
3. [Tech constraints](#tech-constraints)
4. [Architecture overview](#architecture-overview)
5. [The data model](#the-data-model)
6. [File-by-file reference](#file-by-file-reference)
7. [Feature walkthrough](#feature-walkthrough)
8. [The Focus Score formula](#the-focus-score-formula)
9. [Ambient sounds setup](#ambient-sounds-setup)
10. [Theming](#theming)
11. [Responsive breakpoints](#responsive-breakpoints)
12. [Cross-module communication](#cross-module-communication)
13. [Customizing the app](#customizing-the-app)
14. [Known limitations](#known-limitations)
15. [Troubleshooting](#troubleshooting)

---

## Folder structure

```
focusbeat/
├── index.html              All four "pages" live in this one HTML file
├── README.md                This file
├── assests/                 Reserved for static assets (e.g. a logo)
├── css/
│   ├── base.css             CSS reset, design tokens (variables), typography
│   ├── layout.css           Sidebar, topbar, page grids, structural layout
│   ├── components.css       Cards, buttons, timer ring, charts, modals, toasts
│   └── responsive.css       Mobile-first media queries (576 / 768 / 992 / 1200px)
├── js/
│   ├── storage.js           The ONLY file that talks to localStorage directly
│   ├── timer.js              Pomodoro timer logic
│   ├── sounds.js             Ambient soundboard (real <audio> playback)
│   ├── tasks.js               Task manager (add/edit/delete/filter/search)
│   ├── analytics.js           Focus Score, streaks, charts, heatmap
│   └── main.js                 App bootstrap: navigation, theme, toasts, ripple
└── sounds/                  Put your six .mp3 files here (see below)
```

There is no `package.json`, no bundler config, and no `node_modules` —
this project runs by opening a file in a browser.

---

## Getting started

You don't need to install anything. Either:

**Option A — just open it**
Double-click `index.html`, or drag it into a browser window.

**Option B — serve it locally** (recommended, avoids any browser
restrictions on local file access for audio/storage)

```bash
cd focusbeat
npx serve .
# or: python3 -m http.server 8000
```

Then visit `http://localhost:3000` (or whichever port your server prints).

There is nothing to build, compile, or transpile.

---

## Tech constraints

This project deliberately avoids:

- React, Vue, Angular, jQuery
- Bootstrap, Tailwind, or any CSS framework
- Any backend, database, or external API call
- Any bundler, transpiler, or package manager dependency

Everything is hand-written HTML5, CSS3, and ES6+ JavaScript, using only
browser-native APIs: `localStorage`, the DOM, `<audio>`, `setInterval`,
and `CustomEvent`.

---

## Architecture overview

The app is a **single HTML page with four "pages" inside it**
(`#timer-page`, `#sounds-page`, `#tasks-page`, `#analytics-page`). Only one
`.page` has the `.active` class at a time; `main.js` toggles that class
when you click a sidebar/topbar button — there's no real routing or page
reload, so the app feels instant.

JavaScript is split into **independent modules**, one per feature, each
wrapped in an IIFE (Immediately Invoked Function Expression) that returns
a small public API:

```js
const FocusBeatTimer = (function () {
  // private variables and functions live in here, invisible to other files
  function init(sharedData) { /* ... */ }
  return { init: init }; // only `init` is exposed
})();
```

This keeps each file's internal variables (like the countdown interval or
the currently playing sound) from leaking into the global scope or
colliding with another module's variables of the same name.

**Script load order matters** and is fixed in `index.html`:

```html
<script src="js/storage.js"></script>   <!-- 1. no dependencies -->
<script src="js/timer.js"></script>     <!-- 2. uses FocusBeatStorage -->
<script src="js/sounds.js"></script>    <!-- 3. uses FocusBeatStorage -->
<script src="js/tasks.js"></script>     <!-- 4. uses FocusBeatStorage -->
<script src="js/analytics.js"></script> <!-- 5. uses FocusBeatStorage -->
<script src="js/main.js"></script>      <!-- 6. starts everything -->
```

`main.js` is the only file that runs code immediately (inside a
`DOMContentLoaded` listener). All the other modules just *define*
themselves and wait — `main.js` calls each one's `init()` and hands it a
shared reference to the app's data object.

---

## The data model

Everything is stored under a **single localStorage key**:
`focusbeat_data`. Its shape:

```js
{
  tasks: [
    { id: 1718999999000, text: "Write README", completed: false, createdAt: 1718999999000 }
  ],

  sessions: [
    { id: 1718999999111, date: "2026-06-23", duration: 25, completed: true }
  ],

  settings: {
    theme: "dark",            // "dark" | "light"
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    masterVolume: 70          // 0–100
  },

  streak: {
    current: 3,
    longest: 7,
    lastActiveDate: "2026-06-23"  // "YYYY-MM-DD", local time
  },

  timerState: {
    mode: "focus",             // "focus" | "short" | "long"
    secondsLeft: 1230,
    isRunning: false,          // always reset to false on page load
    sessionsCompletedToday: 2,
    lastSavedDateKey: "2026-06-23"
  }
}
```

This object is loaded **once**, when `main.js` runs, via
`FocusBeatStorage.load()`. The same object reference (`appData`) is then
passed into every module's `init(appData)` — so every module is reading
and mutating the *same* object in memory, and any module can call
`FocusBeatStorage.save(appData)` to persist the latest version.

---

## File-by-file reference

### `js/storage.js` — the only file allowed to touch localStorage

| Function | What it does |
|---|---|
| `getDefaultData()` | Returns a brand-new data object for first-time visitors |
| `load()` | Reads `localStorage`, parses the JSON, and merges it with the defaults (so adding new settings later won't break old saved data) |
| `save(data)` | Stringifies and writes the data object back to `localStorage` |
| `getDateKey(date)` | Converts a `Date` into a local `"YYYY-MM-DD"` string. Used everywhere the app needs to compare "did this happen today/yesterday" without timezone bugs from `toISOString()` |

No other file calls `localStorage.setItem`/`getItem` directly — they all
go through this module.

### `js/timer.js` — the Pomodoro engine

- Three modes: **Focus (25m)**, **Short Break (5m)**, **Long Break (15m)**
  (lengths come from `appData.settings`, so they're easy to change).
- `startTimer()` / `pauseTimer()` / `resetTimer()` / `skipToNext()` drive a
  `setInterval` that ticks once per second.
- The SVG progress ring's `stroke-dashoffset` is recalculated on every
  tick based on `secondsLeft / totalSecondsForMode`.
- Every 4 completed Focus sessions automatically routes to a **Long
  Break** instead of a Short one (see `getNextMode()`), matching the
  classic Pomodoro technique. The 4 dots under the ring track this.
- When a **Focus** session reaches 0, `recordFinishedSession()` pushes a
  new entry into `appData.sessions`, updates the streak via
  `updateStreak()`, saves to storage, and fires a
  `focusbeat:dataChanged` event so the Analytics page updates itself
  without timer.js needing to know Analytics exists.
- `playCompletionSound()` plays three short beeps using the **Web Audio
  API** (`OscillatorNode`) — no audio file needed for this one chime.
- The timer's progress (mode, seconds left, running state) is saved to
  `localStorage` on every tick, so refreshing the page mid-session
  doesn't lose your place. `isRunning` is intentionally **not** restored
  as `true` on reload — the timer always reloads paused, so a closed tab
  doesn't keep silently counting down in the background.

### `js/sounds.js` — the ambient soundboard

- Builds one real `<audio>` element per sound (`rain.mp3`, `forest.mp3`,
  `thunder.mp3`, `cafe.mp3`, `ocean.mp3`, `white.mp3`) up front, with
  `loop = true` and `preload = "none"` so nothing downloads until the
  user actually taps a tile.
- `fadeVolume(audio, targetVolume, onDone)` ramps an element's `volume`
  in small steps (`FADE_STEP_MS = 30ms`) over `FADE_DURATION_MS = 800ms`.
  **Each `<audio>` element tracks its own fade timer** (`audio.fadeTimerId`)
  instead of sharing one global timer — this was a real bug we fixed:
  sharing one timer meant starting a new sound's fade-in could cancel
  another sound's fade-out *before it called `.pause()`*, so the old
  sound kept playing quietly in the background.
- `toggleSound()` always calls `stopActiveSound()` first, then starts the
  newly clicked sound if it wasn't already the one playing — this is how
  "only one sound at a time" is enforced.
- The master volume slider (`#masterVolumeSlider`) updates
  `appData.settings.masterVolume`, saves it, and immediately applies it
  to whichever sound is currently playing.

### `js/tasks.js` — task manager

- `addTask`, `deleteTask`, `toggleTaskCompleted`, and an edit flow
  (`openEditModal` → `saveEditedTask`) cover full CRUD.
- `getVisibleTasks()` applies both the active **filter** (`all` /
  `active` / `completed`) and the **search box** text together, so you
  can search within "Active" or "Done" too.
- Every change calls `persistAndRefresh()`, which saves to storage,
  re-renders the list, updates the filter counters, and fires
  `focusbeat:dataChanged` so Analytics recalculates the Focus Score.
- Task text is inserted with `textContent`, never `innerHTML`, so typing
  HTML/script tags into a task can't do anything unexpected.

### `js/analytics.js` — scores, streaks, and charts

- All numbers are **derived on the fly** from `appData` every time
  `renderAll()` runs — nothing is pre-calculated or cached, so there's
  only one source of truth (the raw `sessions`/`tasks`/`streak` data).
- Renders three sections:
  1. **Timer page widgets** — Focus Score card, streak card, today's
     stats card.
  2. **Analytics page summary** — total focus time, sessions, tasks,
     streak.
  3. **Analytics page charts** — a 7-day bar chart and a 28-day heatmap,
     both built from scratch as plain `<div>` grids styled with CSS
     (no chart library).
- Listens for `focusbeat:dataChanged` (fired by `timer.js` and
  `tasks.js`) and re-renders everything automatically — Analytics never
  needs to be told directly that something changed.
- The streak's fire emoji gets a `.celebrating` CSS animation class added
  only on the render where `streak.current` increased since the last
  render (tracked with `previousStreakValue`).

### `js/main.js` — the glue

- Loads the data once (`FocusBeatStorage.load()`) and calls
  `FocusBeatTimer.init()`, `FocusBeatSounds.init()`, `FocusBeatTasks.init()`,
  and `FocusBeatAnalytics.init()`, each with that same shared object.
- Owns everything that isn't a single feature's responsibility:
  - **Page navigation** — toggling `.active` on sidebar buttons and pages.
  - **Mobile sidebar** — hamburger button + dark overlay + slide-in panel.
  - **Theme toggle** — adds/removes `.light-theme` on `<body>`, persists
    the choice, swaps the 🌙/☀️ icon.
  - **`window.FocusBeatToast.show(message)`** — a small notification
    system any module can call (used after adding/deleting a task,
    finishing a session, or a sound file failing to load).
  - **Ripple effect** — a single document-level click listener that, if
    the click landed on a button matching `.start-btn, .add-task-btn,
    .save-btn, .icon-btn, .mode-btn`, injects an expanding `<span
    class="ripple">` positioned at the click coordinates.

---

## Feature walkthrough

### 1. Pomodoro Timer
Switch modes → Start → the ring drains clockwise (well, counter-clockwise
visually because the SVG is rotated -90°) → on completion you get three
beeps, a popup, and (if it was a Focus session) a saved session record.
Reset puts the current mode back to its full duration; Skip jumps straight
to the next mode without waiting.

### 2. Ambient Soundboard
Tap a tile to fade it in; tap it again (or tap a different tile) to fade
it out and fade the new one in. The volume slider affects whichever sound
is currently playing, immediately.

### 3. Task Manager
Type and hit Enter (or click **+ Add**) to add a task. Click the circular
checkbox to complete it, the pencil to edit it in a modal, or the trash
icon to delete it. Use the **All / Active / Done** filters and the search
box together to narrow the list.

### 4. Focus Session Tracker
Every completed Focus session is appended to `appData.sessions` as
`{ id, date, duration, completed }`. This is the raw data every chart and
the score formula are built from.

### 5. Focus Score System — see next section.

### 6. Streak Tracking
`updateStreak()` runs once per completed Focus session. If the last
counted day was yesterday, the streak continues (`current += 1`); if it
was today already, nothing changes; otherwise the streak resets to `1`.
`longest` always tracks the highest `current` ever reached.

### 7. Analytics Dashboard
Total focus time, sessions, tasks, and streak at a glance, plus a 7-day
bar chart and a 28-day activity heatmap, both built with plain divs and
CSS — no canvas, no SVG charting, no library.

### 8. Dark Mode
Defaults to dark. Toggle from the sidebar (desktop) or topbar (mobile);
the choice is saved in `appData.settings.theme` and reapplied on every
load.

### 9. Local Storage System
Described in [The data model](#the-data-model) above.

---

## The Focus Score formula

```
Focus Score = (Completed Sessions × 10) + (Completed Tasks × 5) + (Current Streak × 20)
```

Implemented in `analytics.js` → `calculateFocusScore()`. The score maps to
a productivity **level**:

| Level | Minimum score |
|---|---|
| Beginner | 0 |
| Focused | 50 |
| Productive | 150 |
| Deep Work | 300 |
| Master | 500 |

The progress bar under the score fills based on how far you are between
your current level's threshold and the next one
(`getProgressWithinLevel()`). At **Master**, the bar simply shows 100%.

---

## Ambient sounds setup

Place six `.mp3` files in the `sounds/` folder with these exact names:

```
sounds/rain.mp3
sounds/forest.mp3
sounds/thunder.mp3
sounds/cafe.mp3
sounds/ocean.mp3
sounds/white.mp3
```

If your files are named differently, open `js/sounds.js` and edit the
`file:` path for each entry in the `SOUND_LIBRARY` array near the top of
the file — nothing else needs to change.

```js
const SOUND_LIBRARY = [
  { id: "rain", name: "Rain", icon: "🌧️", file: "sounds/rain.mp3" },
  // ...edit the file paths here
];
```

Each `<audio>` element uses `preload = "none"`, so files are only fetched
the first time their tile is tapped — opening the Sounds page does not
trigger six downloads.

---

## Theming

All colors, spacing, radii, fonts, and transition speeds are defined once
as CSS custom properties in `css/base.css` under `:root`. The light theme
is a second block of overrides scoped to `body.light-theme`:

```css
:root { --bg-body: #0b0d12; --text-primary: #e6edf3; /* dark defaults */ }
body.light-theme { --bg-body: #f6f7f9; --text-primary: #1c2128; /* overrides */ }
```

Every component file (`layout.css`, `components.css`) only ever references
`var(--something)` — never a hard-coded color — so changing a single
variable in `base.css` re-themes the entire app.

---

## Responsive breakpoints

Mobile-first: the un-prefixed CSS rules in `responsive.css` target phones
(sidebar hidden behind a hamburger menu, single-column grids). Each
`@media (min-width: ...)` block then layers on more structure as the
viewport grows:

| Breakpoint | What changes |
|---|---|
| *(default, <576px)* | Sidebar hidden, topbar shown, single-column layouts |
| `576px` | Sound tiles become a 2-column grid |
| `768px` | Sidebar becomes permanent, topbar hides, heatmap widens |
| `992px` | Timer page becomes 2 columns, sound tiles become 3 columns, full 14-column heatmap |
| `1200px` | Slightly roomier page padding, wider stats column |

---

## Cross-module communication

Modules don't import or call into each other's internals directly. Two
lightweight patterns keep them decoupled:

1. **Shared data reference** — `main.js` passes the *same* `appData`
   object into every module's `init()`. Any module can read or mutate it
   and call `FocusBeatStorage.save(appData)`.
2. **Custom events** — `timer.js` and `tasks.js` both
   `document.dispatchEvent(new CustomEvent("focusbeat:dataChanged"))`
   whenever sessions, tasks, or the streak change. `analytics.js` listens
   for that one event and re-renders everything — it never needs to know
   *which* module triggered the change.

This means you could delete the Tasks feature entirely and the Timer and
Analytics modules wouldn't need a single line changed.

---

## Customizing the app

| Want to change... | Edit this |
|---|---|
| Timer durations | `appData.settings.focusMinutes` / `shortBreakMinutes` / `longBreakMinutes` in `storage.js`'s `getDefaultData()` |
| Score formula / point values | `calculateFocusScore()` in `analytics.js` |
| Level names / thresholds | the `LEVELS` array at the top of `analytics.js` |
| Sound files | the `SOUND_LIBRARY` array in `sounds.js` |
| Fade speed for sounds | `FADE_DURATION_MS` / `FADE_STEP_MS` in `sounds.js` |
| Colors / fonts / spacing | the `:root` variables in `base.css` |
| Breakpoints | the `@media` values in `responsive.css` |

---

## Known limitations

- The Pomodoro countdown only runs while the tab is open; closing the tab
  mid-session stops the countdown (it resumes paused, at the same time
  left, next time you open the app).
- All data is per-browser, per-device. There's no sync or backup — it's
  `localStorage`, so clearing site data or using a different browser/
  device starts fresh.
- The Web Audio completion chime and the `<audio>`-based ambient sounds
  both require a user-initiated click before they'll play, per standard
  browser autoplay restrictions — this is already satisfied by the app's
  click-driven UI.

---

## Troubleshooting

**A sound tile doesn't play / "Couldn't play [sound]" toast appears**
The corresponding `.mp3` file isn't at the path listed in `sounds.js`'s
`SOUND_LIBRARY`. Double check the filename and that it's inside `sounds/`.

**Data doesn't persist between visits**
Some browsers clear `localStorage` for files opened via `file://` after
certain settings (privacy mode, "block all cookies", etc.). Serving the
folder with `npx serve .` or a similar local server avoids this.

**The timer "jumps" after switching browser tabs for a while**
This is expected for any `setInterval`-based timer — most browsers throttle
timers in inactive tabs. The displayed time will briefly catch up once the
tab is active again; total elapsed time is still accurate.