// npm install --no-save jsdom && node tests/character-animation.cjs
const { JSDOM } = require("jsdom");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const dom = new JSDOM(
    '<body><span id="hud-level">1</span><div id="character-wrap"><div id="art" class="character-stack show"></div></div><button id="tap-btn"></button></body>',
    {
      runScripts: "outside-only",
      url: "https://game.test",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window;
  w.matchMedia = () => ({ matches: false });
  const manifest = JSON.parse(
    fs.readFileSync("assets/characters/animation-manifest.json", "utf8"),
  );
  w.fetch = async () => ({ ok: true, json: async () => manifest });
  w.Image = function () {
    const img = w.document.createElement("img");
    img.decode = async () => {};
    Object.defineProperty(img, "src", {
      get() {
        return img.getAttribute("src");
      },
      set(v) {
        img.setAttribute("src", v);
        queueMicrotask(() => img.onload?.());
      },
    });
    return img;
  };
  w.eval(fs.readFileSync("js/character-animation.js", "utf8"));
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  await w.CharacterAnimation.ready;
  const el = w.document.getElementById("art");
  w.CharacterAnimation.mount(el, "assets/characters/tier1.webp");
  w.CharacterAnimation.mount(el, "assets/characters/tier1.webp"); // same-src must not cancel pending preload
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(el.querySelectorAll(".rig-layer").length, 5);
  assert.equal(el.firstElementChild.dataset.animationMode, "layered");
  assert(el.querySelector(".face-open"));
  assert(el.querySelector(".face-closed"));
  for (let tier = 2; tier <= 5; tier++) {
    w.document.getElementById("hud-level").textContent = [0, 1, 11, 26, 51, 76][
      tier
    ];
    w.CharacterAnimation.mount(el, `assets/characters/tier${tier}.webp`);
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(
      el.firstElementChild.dataset.animationMode,
      manifest.tiers[tier].status,
    );
    if (manifest.tiers[tier].status === "layered") {
      assert.equal(el.querySelectorAll(".rig-layer").length, 5);
      assert(el.querySelector(".rig-hair-front"));
      assert(el.querySelector(".face-closed"));
      if (manifest.tiers[tier].viewport) {
        assert(el.querySelector(".rig-scene").style.top.startsWith("-"));
      }
    }
    assert(w.document.body.classList.contains("tier-" + tier));
  }
  // Incoming rendering cannot be overwritten by an older asynchronous preload.
  w.CharacterAnimation.mount(el, "assets/characters/tier1.webp");
  w.CharacterAnimation.mount(el, "assets/characters/tier5.webp");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(
    el.firstElementChild.dataset.animationMode,
    manifest.tiers[5].status,
  );
  // A manifest status toggle alone must never bypass the content quarantine.
  const safetyConfig = manifest.tiers[2];
  const savedStatus = safetyConfig.status,
    savedLayers = safetyConfig.layers;
  safetyConfig.status = "layered";
  safetyConfig.layers = safetyConfig.candidateLayers;
  w.CharacterAnimation.mount(el, "assets/characters/tier2.webp");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(el.firstElementChild.dataset.animationMode, "fallback");
  assert.equal(el.firstElementChild.dataset.safetyFallback, "content-audit");
  assert.equal(el.querySelectorAll(".layer-face,.layer-face-blink").length, 0);
  safetyConfig.status = savedStatus;
  safetyConfig.layers = savedLayers;
  w.CharacterAnimation.mount(el, "assets/characters/tier3.webp");
  w.CharacterAnimation.unmount(el);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(
    el.childElementCount,
    0,
    "unmounted faces must not return after decode",
  );
  w.CharacterAnimation.mount(el, "assets/characters/tier3.webp");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(el.querySelectorAll(".layer-face,.layer-face-blink").length, 2);
  dom.window.close();
  console.log(
    "PASS layered rendering, explicit fallbacks, tier classes, same-src preload, stale-load cancellation",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
