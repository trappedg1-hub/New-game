const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (await require("@sparticuz/chromium").default.executablePath()),
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const url = process.env.GAME_URL || "http://localhost:8765";
  async function setup(overrides = {}) {
    const p = await b.newPage({
      viewport: { width: 1280, height: 900 },
      serviceWorkers: "block",
    });
    p.errors = [];
    p.on("pageerror", (e) => p.errors.push(e.message));
    await p.addInitScript(
      (overrides) =>
        !localStorage.getItem("waifuB_save_v1") &&
        localStorage.setItem(
          "waifuB_save_v1",
          JSON.stringify({
            v: 1,
            gems: 2000,
            lastSeen: Date.now(),
            streak: { last: new Date().toISOString().slice(0, 10), count: 1 },
            ...overrides,
          }),
        ),
      overrides,
    );
    await p.goto(url);
    await p.waitForTimeout(650);
    await p.evaluate(() => (Math.random = () => 0.1));
    await p.locator("[data-modal=gacha]").click();
    return p;
  }
  const state = (p) =>
    p.evaluate(() => JSON.parse(localStorage.getItem("waifuB_save_v1")));
  try {
    let p = await setup();
    await p.locator("#pull-x1").click();
    let s = await state(p);
    assert.equal(s.gems, 1900);
    assert.equal(s.energy, 100);
    assert(s.owned.includes("cardigan"));
    assert.equal(s.freePull, 0);
    assert.equal(await p.locator(".new-badge").count(), 1);
    assert.equal(await p.locator(".costume-thumb.locked").count(), 8);
    await p.locator("#reveal-close").click();
    await p.locator("#pull-x1").click();
    s = await state(p);
    assert.equal(s.gems, 1800);
    assert.equal(s.coins, 50);
    assert.equal(await p.locator(".dup-tag").count(), 1);
    await p.locator("#reveal-close").click();
    await p.locator("#pull-x10").click();
    s = await state(p);
    assert.equal(s.gems, 900);
    assert.equal(s.stats.pulls, 12);
    assert.equal(await p.locator(".reveal-card").count(), 10);
    assert(s.owned.includes("maid"), "SR@10 must award upgraded R outfit");
    await p.locator("#reveal-close").click();
    await p.locator("#pull-free").click();
    s = await state(p);
    assert.equal(s.gems, 900);
    assert.equal(s.stats.pulls, 13);
    assert(s.freePull > 0);
    await p.locator("#reveal-close").click();
    assert(await p.locator("#pull-free").isDisabled());
    await p.reload();
    await p.waitForTimeout(600);
    assert.equal((await state(p)).stats.pulls, 13);
    assert.deepEqual(p.errors, []);
    await p.close();
    console.log(
      "PASS gem prices, x10 discount, free 24h, duplicate coins, NEW, unlocks, SR pity, reload",
    );
    p = await setup({ gems: 100, pity: { sr: 9, ssr: 49 } });
    await p.locator("#pull-x1").click();
    s = await state(p);
    assert.equal(s.pity.ssr, 0);
    assert.equal(s.pity.sr, 0);
    assert(s.owned.includes("gown"));
    assert.equal(await p.locator(".reveal-card.SSR").count(), 1);
    await p.waitForTimeout(300);
    assert((await p.locator(".gacha-confetti").count()) > 0);
    const img = await p
      .locator(".reveal-card img")
      .evaluate((i) => i.complete && i.naturalWidth > 0);
    assert(img);
    assert.deepEqual(p.errors, []);
    await p.locator("#reveal-close").click();
    await p.locator("#modal-gacha .modal-close").click();
    await p.locator('[data-modal="inventory"]').click();
    await p
      .locator("#modal-inventory .inv-item")
      .filter({ hasText: "Silk Nightgown" })
      .click();
    await p.waitForTimeout(900);
    await p.waitForFunction(()=>document.querySelector('.body-base')?.getAttribute('src')==='assets/characters/costume_gown/body_base.png');
    assert.equal(await p.locator('#character-surface img').count(),5,'SSR equips registered five-layer nightgown rig');
    await p.close();
    console.log(
      "PASS SSR@50 priority, gold card, confetti, decoded costume art",
    );
    p = await setup({ gems: 99, freePull: Date.now() });
    assert(await p.locator("#pull-x1").isDisabled());
    assert(await p.locator("#pull-x10").isDisabled());
    assert(await p.locator("#pull-free").isDisabled());
    assert.equal((await state(p)).gems, 99);
    await p.close();
    console.log("PASS insufficient funds and free cooldown");
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
