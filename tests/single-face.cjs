const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (await require("@sparticuz/chromium").default.executablePath()),
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      serviceWorkers: "block",
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
      localStorage.setItem(
        "waifuB_save_v1",
        JSON.stringify({
          v: 1,
          owned: [
            "base",
            "cardigan",
            "track",
            "apron",
            "maid",
            "pool",
            "gown",
            "bunny",
          ],
          lastSeen: Date.now(),
          streak: { last: new Date().toISOString().slice(0, 10), count: 1 },
        }),
      );
    });
    await page.goto(process.env.GAME_URL || "http://localhost:8765");
    await page.waitForSelector(".character-stack.show .face-closed");
    assert.equal(
      await page
        .locator(
          ".character-stack .layer-face,.character-stack .layer-face-blink",
        )
        .count(),
      2,
      "startup must not create an inactive duplicate pair",
    );
    for (let tier = 1; tier <= 5; tier++) {
      await page.evaluate((t) => {
        CharacterAnimation.mount(
          document.querySelector(".character-stack.show"),
          `assets/characters/tier${t}.webp`,
        );
      }, tier);
      if (tier === 2) {
        await page.waitForSelector(
          '.character-stack.show [data-animation-mode="fallback"]',
        );
        assert.equal(
          await page.locator(".character-stack.show img").count(),
          1,
        );
        assert.equal(
          await page
            .locator(
              ".character-stack .layer-face,.character-stack .layer-face-blink",
            )
            .count(),
          0,
        );
        console.log(
          "PASS Tier 2 safety quarantine: one clean whole image, zero face overlays",
        );
        continue;
      }
      await page.waitForSelector(".character-stack.show .face-closed");
      const result = await page.evaluate(() => {
        const root = document.querySelector(
            ".character-stack.show .character-rig",
          ),
          faces = [
            root.querySelector(".face-open"),
            root.querySelector(".face-closed"),
          ];
        const states = [];
        for (const time of [
          0, 1000, 4699, 4700, 4750, 4800, 4849, 4850, 4900, 5000, 9700,
        ]) {
          for (const face of faces)
            for (const animation of face.getAnimations()) {
              animation.pause();
              animation.currentTime = time;
            }
          states.push(faces.map((f) => Number(getComputedStyle(f).opacity)));
        }
        // Taps must not create images or override blink state.
        CharacterAnimation.react();
        return {
          states,
          total: document.querySelectorAll(
            ".character-stack .layer-face,.character-stack .layer-face-blink",
          ).length,
          open: root.querySelectorAll(".layer-face").length,
          closed: root.querySelectorAll(".layer-face-blink").length,
          mask: getComputedStyle(faces[1]).maskImage,
        };
      });
      assert.equal(result.total, 2);
      assert.equal(result.open, 1);
      assert.equal(result.closed, 1);
      assert.equal(result.mask, "none");
      assert.deepEqual(result.states, [
        [1, 0],
        [1, 0],
        [1, 0],
        [0, 1],
        [0, 1],
        [0, 1],
        [0, 1],
        [1, 0],
        [1, 0],
        [1, 0],
        [0, 1],
      ]);
      console.log("PASS exclusive blink, exactly two faces, tap tier", tier);
    }
    // Exercise the real dual-slot wardrobe path, not just direct renderer mounts.
    await page.locator("[data-modal=inventory]").click();
    const items = page.locator("#modal-inventory .inv-item");
    for (let i = 1; i <= 7; i++) {
      await items.nth(i).click();
      await page.waitForTimeout(100);
      assert.equal(await page.locator(".character-stack.show img").count(), 1);
      assert.equal(
        await page
          .locator(
            ".character-stack .layer-face,.character-stack .layer-face-blink",
          )
          .count(),
        0,
        "whole-art costumes must not retain previous tier faces",
      );
      assert.equal(
        await page.locator(".character-stack:not(.show) img").count(),
        0,
      );
    }
    await items.nth(0).click();
    await page.waitForSelector(".character-stack.show .face-closed");
    assert.equal(
      await page
        .locator(
          ".character-stack .layer-face,.character-stack .layer-face-blink",
        )
        .count(),
      2,
    );
    assert.equal(
      await page.locator(".character-stack:not(.show) img").count(),
      0,
    );
    console.log(
      "PASS all 7 wardrobe costumes, atomic swaps, base return without stale faces",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
