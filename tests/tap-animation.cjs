// Browser regression: npm install --no-save playwright @sparticuz/chromium
// GAME_URL defaults to the local preview; CHROMIUM_PATH may select system Chrome.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const executablePath =
    process.env.CHROMIUM_PATH ||
    (await require("@sparticuz/chromium").default.executablePath());
  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    for (const [tier, cores, touch] of [
      [1, 8, false],
      [3, 8, true],
      [4, 8, false],
      [2, 2, true],
      [2, 8, false],
      [5, 8, true],
    ]) {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        hasTouch: touch,
        isMobile: touch,
        serviceWorkers: "block",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        ({ tier, cores }) => {
          Object.defineProperty(navigator, "hardwareConcurrency", {
            get: () => cores,
          });
          localStorage.setItem(
            "waifuB_save_v1",
            JSON.stringify({
              v: 1,
              level: [0, 1, 11, 26, 51, 76][tier],
              lastSeen: Date.now(),
              streak: { last: new Date().toISOString().slice(0, 10), count: 1 },
            }),
          );
          const original = Element.prototype.animate;
          window.bodyReactions = 0;
          Element.prototype.animate = function (...args) {
            if (this.matches(".rig-tap-body")) window.bodyReactions++;
            return original.apply(this, args);
          };
        },
        { tier, cores },
      );
      await page.goto(process.env.GAME_URL || "http://localhost:8765");
      await page.evaluate(() => CharacterAnimation.ready);
      await page.waitForTimeout(1400);
      await page.evaluate(() => {
        const root = document.querySelector(
          ".character-stack.show .character-rig",
        );
        window.idles = [...root.querySelectorAll("*")].flatMap((el) =>
          el.getAnimations().filter((a) => a instanceof CSSAnimation),
        );
        window.starts = idles.map((a) => a.startTime);
        window.beforeTaps =
          JSON.parse(localStorage.getItem("waifuB_save_v1")).stats?.taps || 0;
        window.badFrames = [];
        window.auditTimer = setInterval(() => {
          let el = root;
          while (el && el !== document.body) {
            const s = getComputedStyle(el);
            if (
              +s.opacity < 0.95 ||
              s.visibility === "hidden" ||
              s.display === "none"
            )
              badFrames.push("hidden ancestor " + el.className);
            el = el.parentElement;
          }
          if (
            getComputedStyle(
              root.querySelector(".layer-body") || root.querySelector("img"),
            ).opacity === "0"
          )
            badFrames.push("body hidden");
          const body = root.querySelector(".layer-body");
          if (body) {
            const expected = body.getBoundingClientRect();
            for (const face of root.querySelectorAll(
              ".layer-face,.layer-face-blink",
            )) {
              const rect = face.getBoundingClientRect();
              if (
                ["x", "y", "width", "height"].some(
                  (key) => Math.abs(rect[key] - expected[key]) > 0.01,
                )
              )
                badFrames.push("face/body registration drift");
            }
          }
          const faces = [
            ...root.querySelectorAll(".layer-face,.layer-face-blink"),
          ];
          if (
            faces.length &&
            faces.reduce(
              (sum, el) => sum + Number(getComputedStyle(el).opacity),
              0,
            ) < 0.99
          )
            badFrames.push("both faces hidden");
        }, 16);
      });
      const target = page.locator("#tap-btn");
      for (let i = 0; i < 10; i++) {
        if (touch) await target.tap();
        else await target.click();
        await page.waitForTimeout(160);
      }
      await page.waitForTimeout(800);
      const result = await page.evaluate(() => {
        clearInterval(auditTimer);
        window.dispatchEvent(new Event("beforeunload"));
        const r = document.querySelector(
          ".character-stack.show .character-rig",
        );
        return {
          badFrames,
          taps:
            JSON.parse(localStorage.getItem("waifuB_save_v1")).stats.taps -
            beforeTaps,
          reactions: bodyReactions,
          idleStable: idles.every(
            (a, i) => a.startTime === starts[i] && a.playState === "running",
          ),
          activeReactions: r
            .getAnimations({ subtree: true })
            .filter((a) => !(a instanceof CSSAnimation)).length,
          bounce: getComputedStyle(r.querySelector(".rig-tap-body")).transform,
          mode: r.dataset.animationMode,
        };
      });
      assert.deepEqual(result.badFrames, []);
      assert.equal(result.taps, 10, "touch/click must count exactly once");
      assert.equal(result.reactions, 10);
      assert(
        result.idleStable,
        "idle CSS animation identity/clock must be unchanged",
      );
      assert.equal(result.activeReactions, 0, "no residual WAAPI transforms");
      assert.equal(result.bounce, "none");
      if (result.mode === "layered") {
        const blink = await page.evaluate(() => {
          const root = document.querySelector(
            ".character-stack.show .character-rig",
          );
          const faces = [
            root.querySelector(".face-open"),
            root.querySelector(".face-closed"),
          ];
          return [0, 4700, 4725, 4750, 4800, 4850, 4875, 4900].map((time) => {
            for (const el of faces)
              for (const a of el.getAnimations()) {
                a.pause();
                a.currentTime = time;
              }
            return faces.map((el) => Number(getComputedStyle(el).opacity));
          });
        });
        for (const pair of blink)
          assert(
            pair[0] === 1 && pair[1] >= 0 && pair[1] <= 1,
            "open face must remain opaque under the eyelid crossfade",
          );
      }
      // Atomic tier switch still works after spam.
      await page.evaluate(() =>
        CharacterAnimation.mount(
          document.querySelector(".character-stack.show"),
          "assets/characters/tier4.webp",
        ),
      );
      await page.waitForTimeout(400);
      assert.equal(
        await page.locator(".character-stack.show .rig-layer").count(),
        5,
      );
      assert.deepEqual(errors, []);
      console.log("PASS tap spam, no flash/restart/drift, tier swap", {
        tier,
        cores,
        touch,
        ...result,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
