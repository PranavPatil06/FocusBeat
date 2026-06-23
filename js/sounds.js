/* ==========================================================================
   SOUNDS.JS
   The ambient soundboard. Each sound is a real looping .mp3 file played
   through an <audio> element. Only one sound can play at a time, and
   switching sounds (or pressing play/pause) always fades the volume in
   or out smoothly instead of cutting abruptly.
   ========================================================================== */

const FocusBeatSounds = (function () {

  const FADE_DURATION_MS = 800;
  const FADE_STEP_MS = 30;

  const SOUND_LIBRARY = [
    { id: "rain", name: "Rain", icon: "🌧️", file: "sounds/rain.mp3" },
    { id: "forest", name: "Forest", icon: "🌲", file: "sounds/forest.mp3" },
    { id: "thunder", name: "Thunder", icon: "⛈️", file: "sounds/thunder.mp3" },
    { id: "cafe", name: "Coffee Shop", icon: "☕", file: "sounds/cafe.mp3" },
    { id: "ocean", name: "Ocean Waves", icon: "🌊", file: "sounds/ocean.mp3" },
    { id: "white", name: "White Noise", icon: "📻", file: "sounds/white.mp3" }
  ];

  let appData = null;
  let soundsGrid = null;
  let volumeSlider = null;
  let volumePercentText = null;

  // One real <audio> element per sound, created once and reused.
  const audioElements = {};

  let activeSoundId = null;

  function getMasterVolume() {
    return appData.settings.masterVolume / 100;
  }

  function createAudioElements() {
    SOUND_LIBRARY.forEach((soundConfig) => {
      const audio = new Audio(soundConfig.file);
      audio.loop = true;
      audio.preload = "none"; // don't download every track until it's actually played
      audio.volume = 0;
      audio.fadeTimerId = null; // each audio element tracks its own fade, not a shared one
      audioElements[soundConfig.id] = audio;
    });
  }

  // Smoothly ramps ONE specific <audio> element's volume from its current
  // value to a target value over FADE_DURATION_MS, then runs an optional
  // callback. Storing the timer on the audio element itself (instead of in
  // one shared variable) means fading sound A in can never accidentally
  // cancel sound B's fade-out before it finishes pausing.
  function fadeVolume(audio, targetVolume, onDone) {
    clearInterval(audio.fadeTimerId);

    const startVolume = audio.volume;
    const steps = Math.round(FADE_DURATION_MS / FADE_STEP_MS);
    let currentStep = 0;

    audio.fadeTimerId = setInterval(() => {
      currentStep += 1;
      const progress = currentStep / steps;
      audio.volume = startVolume + (targetVolume - startVolume) * progress;

      if (currentStep >= steps) {
        clearInterval(audio.fadeTimerId);
        audio.fadeTimerId = null;
        audio.volume = targetVolume;
        if (onDone) onDone();
      }
    }, FADE_STEP_MS);
  }

  function playSound(soundConfig, tileElement) {
    const audio = audioElements[soundConfig.id];

    audio.volume = 0;
    audio.currentTime = 0;
    audio.play().catch((error) => {
      console.warn(`FocusBeat: could not play ${soundConfig.name}.`, error);
      window.FocusBeatToast.show(`Couldn't play ${soundConfig.name}. Check the file exists in /sounds.`);
    });

    fadeVolume(audio, getMasterVolume());

    activeSoundId = soundConfig.id;
    tileElement.classList.add("playing");
  }

  function stopActiveSound() {
    if (!activeSoundId) return;

    const audio = audioElements[activeSoundId];
    const tileElement = soundsGrid.querySelector(`[data-sound-id="${activeSoundId}"]`);

    fadeVolume(audio, 0, () => {
      audio.pause();
    });

    if (tileElement) tileElement.classList.remove("playing");
    activeSoundId = null;
  }

  function toggleSound(soundConfig, tileElement) {
    const wasPlaying = activeSoundId === soundConfig.id;

    stopActiveSound();

    if (!wasPlaying) {
      playSound(soundConfig, tileElement);
    }
  }

  // -------------------- Rendering --------------------

  function renderSoundTiles() {
    soundsGrid.innerHTML = "";

    SOUND_LIBRARY.forEach((soundConfig) => {
      const tile = document.createElement("div");
      tile.className = "card sound-tile";
      tile.dataset.soundId = soundConfig.id;

      tile.innerHTML = `
        <div class="sound-tile-top">
          <span class="sound-tile-icon">${soundConfig.icon}</span>
          <button class="sound-play-btn" aria-label="Play ${soundConfig.name}">▶</button>
        </div>
        <div class="sound-tile-name">${soundConfig.name}</div>
        <div class="sound-wave">
          <span></span><span></span><span></span><span></span>
        </div>
      `;

      tile.addEventListener("click", () => toggleSound(soundConfig, tile));
      soundsGrid.appendChild(tile);
    });
  }

  // -------------------- Volume control --------------------

  function handleVolumeChange() {
    const volumeValue = Number(volumeSlider.value);
    volumePercentText.textContent = `${volumeValue}%`;

    appData.settings.masterVolume = volumeValue;
    FocusBeatStorage.save(appData);

    // Update whichever sound is currently playing immediately, no fade needed
    // here since the user is actively dragging the slider.
    if (activeSoundId) {
      audioElements[activeSoundId].volume = getMasterVolume();
    }
  }

  // -------------------- Init --------------------

  function init(sharedData) {
    appData = sharedData;
    soundsGrid = document.getElementById("soundsGrid");
    volumeSlider = document.getElementById("masterVolumeSlider");
    volumePercentText = document.getElementById("volumePercentText");

    createAudioElements();
    renderSoundTiles();

    volumeSlider.value = appData.settings.masterVolume;
    volumePercentText.textContent = `${appData.settings.masterVolume}%`;
    volumeSlider.addEventListener("input", handleVolumeChange);
  }

  return { init: init };

})();