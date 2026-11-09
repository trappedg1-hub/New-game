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
    react.className = "rig-tap-body";
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
    const view = config.viewport;
    const { root, canvas } = frame(view ? [view[2], view[3]] : config.canvas);
    const scene = document.createElement("div");
    scene.className = "rig-scene";
    scene.style.cssText = "position:absolute;inset:0";
    if (view) {
      scene.style.inset = "auto";
      scene.style.left = (-view[0] / view[2]) * 100 + "%";
      scene.style.top = (-view[1] / view[3]) * 100 + "%";
      scene.style.width = (config.canvas[0] / view[2]) * 100 + "%";
      scene.style.height = (config.canvas[1] / view[3]) * 100 + "%";
      scene.style.setProperty(
        "--rig-hair-origin",
        `50% ${(view[1] / config.canvas[1]) * 100}%`,
      );
    }
    canvas.append(scene);
    root.dataset.animationMode = "layered";
    if (config.hairBackReveal) {
      root.style.setProperty(
        "--back-hair-hidden",
        (config.hairBackReveal[0] / config.canvas[1]) * 100 + "%",
      );
      root.style.setProperty(
        "--back-hair-visible",
        (config.hairBackReveal[1] / config.canvas[1]) * 100 + "%",
      );
    }
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
    reactor.append(image(config.layers.body_base, "layer-body"));
    if (config.layers.cloth_loose) {
      const cloth = document.createElement("div");
      cloth.className = "rig-cloth";
      cloth.append(image(config.layers.cloth_loose, "layer-cloth"));
      reactor.append(cloth);
    }
    const face = document.createElement("div");
    face.className = "rig-face";
    face.append(
      image(config.layers.face, "layer-face face-open"),
      image(config.layers.face_blink, "layer-face-blink face-closed"),
    );
    reactor.append(face);
    const frontReact = document.createElement("div");
    frontReact.className = "rig-front-react";
    const frontSway = document.createElement("div");
    frontSway.className = "rig-hair-front";
    frontSway.append(image(config.layers.hair_front, "layer-hair-front"));
    frontReact.append(frontSway);
    reactor.append(frontReact);
    // A shared breathing parent keeps every registered layer moving together.
    const bounce = document.createElement("div");
    bounce.className = "rig-tap-body";
    breath.append(backReact, reactor);
    bounce.append(breath);
    scene.append(bounce);
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
  const reactions = new Map();
  function animateReaction(el, frames, duration) {
    if (!el?.animate) return;
    const previous = reactions.get(el);
    if (previous) {
      // Retarget from the visible pose; rapid taps never accumulate transforms.
      const style = getComputedStyle(el);
      for (const property of Object.keys(frames[0]))
        frames[0][property] = style[property];
      previous.cancel();
    }
    const animation = el.animate(frames, { duration, easing: "ease-out" });
    reactions.set(el, animation);
    const cleanup = () => {
      if (reactions.get(el) === animation) reactions.delete(el);
    };
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
  }
  function stopReactions() {
    for (const animation of reactions.values()) animation.cancel();
    reactions.clear();
  }
  function react() {
    if (
      reduced.matches ||
      document.body.classList.contains("no-motion") ||
      document.hidden
    )
      return;
    for (const root of document.querySelectorAll(
      ".character-stack.show .character-rig",
    )) {
      const style = getComputedStyle(document.body);
      animateReaction(
        root.querySelector(".rig-tap-body"),
        [
          { transform: "translateY(0) scale(1) rotate(0)" },
          { transform: "translateY(3px) scale(0.985)", offset: 0.2 },
          {
            transform: `translateY(${style.getPropertyValue("--tap-y").trim() || "-4px"}) scale(${style.getPropertyValue("--tap-scale").trim() || "1.01"}) rotate(${style.getPropertyValue("--tap-angle").trim() || "0deg"})`,
            offset: 0.5,
          },
          { transform: "translateY(0) scale(1) rotate(0)" },
        ],
        500,
      );
      // Low-end mode retains the body bounce but omits hair and face effects.
      if (lowEnd()) continue;
      animateReaction(
        root.querySelector(".rig-front-react"),
        [
          { transform: "rotate(0) translateY(0)" },
          { transform: "rotate(-4deg) translateY(4px)", offset: 0.3 },
          { transform: "rotate(2deg) translateY(0)", offset: 0.6 },
          { transform: "rotate(0) translateY(0)" },
        ],
        600,
      );
      animateReaction(
        root.querySelector(".rig-back-react"),
        [
          { transform: "rotate(0)" },
          { transform: "rotate(-1deg)", offset: 0.4 },
          { transform: "rotate(0)" },
        ],
        700,
      );
      animateReaction(
        root.querySelector(".rig-face"),
        [
          { filter: "brightness(1) saturate(1)" },
          { filter: "brightness(1.1) saturate(1.25)", offset: 0.3 },
          { filter: "brightness(1) saturate(1)" },
        ],
        400,
      );
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    syncTier();
    new MutationObserver(syncTier).observe(
      document.getElementById("hud-level"),
      { childList: true },
    );
    // Reactions are triggered only by accepted game taps (touch/click/keyboard).
    document.addEventListener("visibilitychange", () => {
      syncTier();
      if (document.hidden) stopReactions();
    });
    reduced.addEventListener?.("change", () => {
      if (reduced.matches) stopReactions();
    });
    window.addEventListener("resize", syncTier, { passive: true });
  });
  window.CharacterAnimation = { mount, ready, react };
})();
