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
      viewport: { width: 390, height: 844 },
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
      await p.waitForTimeout(400);
      const result = await p.evaluate(() => {
        const root = document.querySelector(
            ".character-stack.show .character-rig",
          ),
          body = root.querySelector(".layer-body"),
          faces = [...root.querySelectorAll(".layer-face,.layer-face-blink")];
        const animations = root.getAnimations({ subtree: true });
        const deltas = [];
        for (const time of [0, 750, 1750, 3500, 4750, 4800, 6500, 7900]) {
          for (const a of animations) {
            a.pause();
            a.currentTime = time;
          }
          const bb = body.getBoundingClientRect();
          for (const face of faces) {
            const fb = face.getBoundingClientRect();
            deltas.push(
              Math.max(
                ...["x", "y", "width", "height"].map((k) =>
                  Math.abs(fb[k] - bb[k]),
                ),
              ),
            );
          }
        }
        return {
          mode: root.dataset.animationMode,
          maxDelta: Math.max(...deltas),
          faceAnimation: getComputedStyle(root.querySelector(".rig-face"))
            .animationName,
          faceTransform: getComputedStyle(root.querySelector(".rig-face"))
            .transform,
          sameParent: faces.every(
            (f) => f.parentElement.parentElement === body.parentElement,
          ),
          synced: !!body.closest(".layer-synced"),
          z: faces.map((f) => getComputedStyle(f).zIndex),
          faceFilter: getComputedStyle(root.querySelector(".rig-face")).filter,
          blinkMask: getComputedStyle(faces[1]).maskImage,
        };
      });
      assert.equal(result.mode, "layered");
      assert(result.maxDelta < 0.01, "face must follow exact body matrix");
      assert.equal(result.faceAnimation, "none");
      assert.equal(result.faceTransform, "none");
      assert.equal(result.faceFilter, "none");
      assert(result.blinkMask.includes("data:image/svg+xml"));
      assert(result.sameParent && result.synced);
      assert.deepEqual(result.z, ["4", "4"]);
      console.log(
        "PASS full-cycle registered faces, blink/tier switch",
        tier,
        result,
      );
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
