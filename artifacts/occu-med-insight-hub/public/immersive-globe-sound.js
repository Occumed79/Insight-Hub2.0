(() => {
  if (window.__occuMedImmersiveGlobeSoundInstalled) return;
  window.__occuMedImmersiveGlobeSoundInstalled = true;

  const AUDIO_URL = "/immersive-globe-transition.mp3";
  const PRELUDE_MS = 130;
  let audio;
  let replayingClick = false;

  const isImmersiveButton = (button) =>
    button instanceof HTMLButtonElement &&
    button.textContent?.toLowerCase().includes("enter immersive globe");

  const getAudio = () => {
    if (!audio) {
      audio = new Audio(AUDIO_URL);
      audio.preload = "auto";
      audio.volume = 0.85;
    }
    return audio;
  };

  const playTransitionSound = () => {
    const transitionAudio = getAudio();
    transitionAudio.currentTime = 0;
    void transitionAudio.play().catch(() => {
      // A failed sound should never block the immersive transition.
    });
  };

  const showPrelude = () => {
    const prelude = document.createElement("div");
    prelude.className = "immersive-globe-sound-prelude";
    prelude.setAttribute("aria-hidden", "true");
    document.body.appendChild(prelude);
    window.setTimeout(() => prelude.remove(), PRELUDE_MS + 80);
  };

  const style = document.createElement("style");
  style.textContent = `
    .immersive-globe-sound-prelude {
      position: fixed;
      inset: 0;
      z-index: 1299;
      pointer-events: none;
      background:
        radial-gradient(circle at 50% 50%, rgba(255,255,255,.34), rgba(125,249,255,.14) 20%, transparent 52%),
        radial-gradient(circle at 30% 38%, rgba(253,224,71,.12), transparent 24%),
        radial-gradient(circle at 70% 62%, rgba(216,180,254,.14), transparent 26%);
      animation: immersive-globe-sound-prelude ${PRELUDE_MS}ms ease-out both;
    }
    @keyframes immersive-globe-sound-prelude {
      0% { opacity: 0; filter: brightness(.92); transform: scale(.985); }
      100% { opacity: 1; filter: brightness(1.25); transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    const button = target instanceof Element ? target.closest("button") : null;
    if (isImmersiveButton(button)) getAudio().load();
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target;
    const button = target instanceof Element ? target.closest("button") : null;
    if (!isImmersiveButton(button)) return;

    if (replayingClick) {
      replayingClick = false;
      return;
    }

    playTransitionSound();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showPrelude();

    window.setTimeout(() => {
      if (!button.isConnected) return;
      replayingClick = true;
      button.click();
    }, PRELUDE_MS);
  }, true);
})();
