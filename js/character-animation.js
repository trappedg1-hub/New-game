/* Character presentation renderer. No economy, XP, gacha or save mutations. */
(() => {
  "use strict";
  const assetCache = new Map();
  const activeMount = new WeakMap();
  const renderTokens = new WeakMap();
  let manifest = { tiers: {}, costumes: {} };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const lowEnd = () =>
    Number(navigator.hardwareConcurrency || 4) < 4 &&
    matchMedia("(max-width: 767px)").matches;
  const ready = fetch("assets/characters/animation-manifest.json")
    .then((r) => {
      if (!r.ok) throw Error("Manifest unavailable");
      return r.json();
    })
    .then((data) => {
      manifest = data;
      return data;
    })
    .catch(() => manifest);

  function loadImage(path) {
    if (!assetCache.has(path)) {
      const p = new Promise((resolve, reject) => {
        const img = new Image();
        const timer = setTimeout(() => reject(Error("Art timeout")), 12000);
        img.onload = async () => {
          try {
            await img.decode();
          } catch (_) {}
          clearTimeout(timer);
          resolve(path);
        };
        img.onerror = () => {
          clearTimeout(timer);
          reject(Error("Missing layer: " + path));
        };
        img.src = path;
      });
      assetCache.set(path, p);
      p.catch(() => assetCache.delete(path));
    }
    return assetCache.get(path);
  }
  function levelTier() {
    const lv = Number(document.getElementById("hud-level")?.textContent) || 1;
    return lv <= 10 ? 1 : lv <= 25 ? 2 : lv <= 50 ? 3 : lv <= 75 ? 4 : 5;
  }
  function syncTier() {
    const tier = levelTier();
    for (let i = 1; i <= 5; i++)
      document.body.classList.toggle("tier-" + i, i === tier);
    document.body.classList.toggle("animation-low-end", lowEnd());
    document.body.classList.toggle("animation-paused", document.hidden);
  }
  function image(src, cls, alt = "") {
    const el = new Image();
    el.className = "layer rig-layer " + cls;
    el.alt = alt;
    el.draggable = false;
    el.src = src;
    return el;
  }
  function frame(canvasSize) {
    const root = document.createElement("div");
    root.className = "character-rig";
    root.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("div");
    canvas.className = "rig-canvas";
    canvas.style.aspectRatio = canvasSize[0] + " / " + canvasSize[1];
    root.append(canvas);
    return { root, canvas };
  }
  function fallback(src) {
    const { root, canvas } = frame([420, 1323]);
    root.dataset.animationMode = "fallback";
    const react = document.createElement("div");
    react.className = "rig-reactor";
    const sway = document.createElement("div");
    sway.className = "fallback-sway";
    const breath = document.createElement("div");
    breath.className = "rig-breath";
    breath.append(image(src, "animation-fallback-image", "B"));
    sway.append(breath);
    react.append(sway);
    canvas.append(react);
    return root;
  }
  function layered(config) {
    const { root, canvas } = frame(config.canvas);
    root.dataset.animationMode = "layered";
    const backReact = document.createElement("div");
    backReact.className = "rig-back-react";
    const backSway = document.createElement("div");
    backSway.className = "rig-hair-back";
    backSway.append(image(config.layers.hair_back, "layer-hair-back"));
    backReact.append(backSway);
    const reactor = document.createElement("div");
    reactor.className = "rig-reactor";
    const breath = document.createElement("div");
    breath.className = "rig-breath";
    breath.append(image(config.layers.body_base, "layer-body"));
    if (config.layers.cloth_loose) {
      const cloth = document.createElement("div");
      cloth.className = "rig-cloth";
      cloth.append(image(config.layers.cloth_loose, "layer-cloth"));
      breath.append(cloth);
    }
    const face = document.createElement("div");
    face.className = "rig-face";
    face.append(
      image(config.layers.face, "layer-face face-open"),
      image(config.layers.face_blink, "layer-face-blink face-closed"),
    );
    breath.append(face);
    const frontReact = document.createElement("div");
    frontReact.className = "rig-front-react";
    const frontSway = document.createElement("div");
    frontSway.className = "rig-hair-front";
    frontSway.append(image(config.layers.hair_front, "layer-hair-front"));
    frontReact.append(frontSway);
    breath.append(frontReact);
    reactor.append(breath);
    canvas.append(backReact, reactor);
    return root;
  }
  function configFor(src) {
    const tier = src.match(/\/tier([1-5])\.(?:png|webp)(?:\?.*)?$/);
    if (tier) return manifest.tiers[tier[1]];
    const costume = src.match(/\/costume_([a-z]+)\.(?:png|webp)(?:\?.*)?$/);
    return costume ? manifest.costumes[costume[1]] : null;
  }
  function mount(el, src) {
    syncTier();
    const existing = activeMount.get(el);
    if (existing?.src === src && el.firstElementChild) return;
    const token = {};
    renderTokens.set(el, token);
    activeMount.set(el, { src });
    // The old single-PNG appears immediately, while the complete rig decodes offscreen.
    el.replaceChildren(fallback(src));
    ready.then(async () => {
      const config = configFor(src);
      if (!config || config.status !== "layered") {
        const ratio = config?.canvas;
        if (ratio && renderTokens.get(el) === token)
          el.querySelector(".rig-canvas").style.aspectRatio =
            ratio[0] + "/" + ratio[1];
        return;
      }
      try {
        await Promise.all(Object.values(config.layers).map(loadImage));
        if (renderTokens.get(el) !== token || !el.isConnected) return;
        const rig = layered(config);
        el.replaceChildren(rig);
        rig.classList.add("rig-enter");
      } catch (_) {
        // No partial rig is ever mounted; retain the already-visible whole-art fallback.
        if (renderTokens.get(el) === token)
          el.firstElementChild.dataset.layerError = "true";
      }
    });
  }
  let reactionTimer,
    lastReaction = -Infinity;
  function react() {
    if (reduced.matches || document.body.classList.contains("no-motion"))
      return;
    if (performance.now() - lastReaction < 80) return;
    lastReaction = performance.now();
    clearTimeout(reactionTimer);
    const roots = [
      ...document.querySelectorAll(".character-stack.show .character-rig"),
    ];
    roots.forEach((root) => {
      root.classList.remove("rig-reacting");
      void root.offsetWidth;
      root.classList.add("rig-reacting");
    });
    reactionTimer = setTimeout(
      () => roots.forEach((root) => root.classList.remove("rig-reacting")),
      650,
    );
  }
  document.addEventListener("DOMContentLoaded", () => {
    syncTier();
    new MutationObserver(syncTier).observe(
      document.getElementById("hud-level"),
      { childList: true },
    );
    for (const id of ["character-wrap", "tap-btn"])
      document
        .getElementById(id)
        .addEventListener("pointerdown", react, { passive: true });
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !document.querySelector(".modal.open")) react();
    });
    document.addEventListener("visibilitychange", syncTier);
    window.addEventListener("resize", syncTier, { passive: true });
  });
  window.CharacterAnimation = { mount, ready, react };
})();
