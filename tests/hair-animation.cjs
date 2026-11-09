// Run with the same browser dependencies/environment as tap-animation.cjs.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (await require("@sparticuz/chromium").default.executablePath()),
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    const p = await b.newPage({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: "block",
    });
    await p.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
      localStorage.setItem(
        "waifuB_save_v1",
        JSON.stringify({
          v: 1,
          lastSeen: Date.now(),
          streak: { last: new Date().toISOString().slice(0, 10), count: 1 },
        }),
      );
    });
    await p.goto(process.env.GAME_URL || "http://localhost:8765");
    await p.evaluate(() => CharacterAnimation.ready);
    const manifest = require("../assets/characters/animation-manifest.json");
    for (let tier = 1; tier <= 5; tier++) {
      await p.evaluate((t) => {
        document.getElementById("hud-level").textContent = [
          0, 1, 11, 26, 51, 76,
        ][t];
        CharacterAnimation.mount(
          document.querySelector(".character-stack.show"),
          `assets/characters/tier${t}.webp`,
        );
      }, tier);
      await p.waitForTimeout(500);
      const info = await p.evaluate(() => {
        const r = document.querySelector(
          ".character-stack.show .character-rig",
        );
        if (r.dataset.animationMode === "fallback")
          return { mode: "fallback", images: r.querySelectorAll("img").length };
        const back = r.querySelector(".rig-hair-back"),
          front = r.querySelector(".rig-hair-front");
        const settings = (el) => {
          const s = getComputedStyle(el);
          return [s.animationDuration, s.animationDelay, s.animationDirection];
        };
        const samples = [1000, 2500, 4200].map((time) => {
          for (const el of [back, front])
            for (const a of el.getAnimations()) {
              a.pause();
              a.currentTime = time;
            }
          return [
            getComputedStyle(back).transform,
            getComputedStyle(front).transform,
          ];
        });
        CharacterAnimation.react();
        const reaction = (sel) => {
          const a = r.querySelector(sel).getAnimations()[0];
          return {
            duration: a.effect.getTiming().duration,
            frames: a.effect.getKeyframes().map((f) => f.transform),
          };
        };
        return {
          mode: "layered",
          back: settings(back),
          front: settings(front),
          samples,
          mask: getComputedStyle(r.querySelector(".layer-hair-back")).maskImage,
          z: [
            ".rig-back-react",
            ".rig-reactor",
            ".layer-body",
            ".rig-face",
            ".rig-front-react",
          ].map((s) => getComputedStyle(r.querySelector(s)).zIndex),
          backTap: reaction(".rig-back-react"),
          frontTap: reaction(".rig-front-react"),
        };
      });
      assert.equal(info.mode, manifest.tiers[tier].status);
      if (info.mode === "layered") {
        assert.deepEqual(info.back, ["5.5s", "0s", "normal"]);
        assert.deepEqual(info.front, ["4s", "0.8s", "reverse"]);
        assert(info.samples.every(([back, front]) => back !== front));
        assert(info.mask.includes("linear-gradient"));
        assert.deepEqual(info.z, ["1", "2", "2", "4", "5"]);
        assert.equal(info.backTap.duration, 700);
        assert.equal(info.frontTap.duration, 600);
        assert(info.backTap.frames.includes("rotate(-1deg)"));
        assert(info.frontTap.frames.includes("rotate(-4deg) translateY(4px)"));
      } else
        assert.equal(info.images, 1, "fallback must not mount duplicate hair");
      if (process.env.HAIR_AUDIT_DIR) {
        await p.waitForTimeout(800);
        await p.screenshot({
          path: `${process.env.HAIR_AUDIT_DIR}/tier${tier}.png`,
        });
      }
      console.log("PASS hair depth/timing/content/tap tier", tier, info);
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
