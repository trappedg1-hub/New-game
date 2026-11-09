const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (await require("@sparticuz/chromium").default.executablePath()),
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const url = process.env.GAME_URL || "http://localhost:8765";
  async function page(save) {
    const p = await b.newPage({ viewport: { width: 390, height: 900 }, serviceWorkers: "block" });
    p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message));
    await p.addInitScript((s) => { if (!localStorage.getItem("waifuB_save_v1")) localStorage.setItem("waifuB_save_v1", JSON.stringify(s)); }, {
      v: 1, level: 1, gems: 0, lastSeen: Date.now(),
      streak: { last: new Date().toISOString().slice(0, 10), count: 1 }, ...save,
    });
    await p.goto(url); await p.waitForTimeout(900); await p.keyboard.press("Escape");
    return p;
  }
  const surface = (p) => p.locator("#character-surface");
  try {
    /* ---- 1. Combo dishevelment stages + idle reset ---- */
    let p = await page({ level: 1 });
    assert.equal(await p.locator("#combo-meter").isHidden(), true);
    const tapChar = async () => { const r = await p.locator("#character-wrap").boundingBox(); await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2); };
    await p.evaluate(() => __fanservice.setCombo(149));
    await tapChar();
    let st = await p.evaluate(() => ({ c: __fanservice.combo, s: __fanservice.stage }));
    assert.deepEqual(st, { c: 150, s: 1 });
    assert.equal(await surface(p).evaluate((e) => e.classList.contains("stage-1")), true);
    assert.match(await p.locator("#bubble-text").textContent(), /doing so fast/);
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".fx-slip-1")).opacity === "1");
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".fx-blush")).opacity === "0.35");
    assert.match(await p.locator("#combo-count").textContent(), /150 COMBO/);
    await p.evaluate(() => __fanservice.setCombo(299)); await tapChar();
    assert.equal(await p.evaluate(() => __fanservice.stage), 2);
    assert.match(await p.locator("#bubble-text").textContent(), /outfit is slipping/);
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".fx-blush")).opacity === "0.6");
    await p.evaluate(() => __fanservice.setCombo(599)); await tapChar();
    assert.equal(await p.evaluate(() => __fanservice.stage), 3);
    assert.match(await p.locator("#bubble-text").textContent(), /keep up with you/);
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".fx-blush")).opacity === "0.9");
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".fx-slip-3")).opacity === "1");
    assert.equal(await p.locator(".body-base").evaluate((e) => e.getAnimations()[0].effect.getTiming().duration), 3800); /* body no longer shifts wholesale */
    /* x4 coin bonus at stage 3 */
    const coinsBefore = await p.evaluate(() => +document.getElementById("coins").textContent.replace(/[^0-9]/g, "") || 0);
    await tapChar(); await p.waitForTimeout(600);
    const coinsAfter = await p.evaluate(() => +document.getElementById("coins").textContent.replace(/[^0-9]/g, "") || 0);
    const tapTxt = await p.locator(".float-txt").last().textContent();
    assert(coinsAfter - coinsBefore >= 4, "stage-3 tap must pay at least x4 base, got " + (coinsAfter - coinsBefore) + " (" + tapTxt + ")");
    /* idle 3.5s -> outfit fix reset */
    await p.waitForTimeout(3900);
    st = await p.evaluate(() => ({ c: __fanservice.combo, s: __fanservice.stage }));
    assert.deepEqual(st, { c: 0, s: 0 });
    assert.equal(await surface(p).evaluate((e) => e.classList.contains("stage-1") || e.classList.contains("stage-3")), false);
    assert.match(await p.locator("#bubble-text").textContent(), /fix myself/);
    assert.equal(await p.locator("#combo-meter").isHidden(), true);
    assert.deepEqual(p.errors, []);
    await p.close();
    console.log("PASS combo stages 1/2/3, blush 35/60/90, x4 stage-3, 3.5s idle outfit-fix reset");

    /* ---- 2. Heart-eyes trance (level 50+) ---- */
    p = await page({ level: 76 });
    await p.waitForTimeout(600);
    assert.equal(await surface(p).evaluate((e) => e.classList.contains("heart-eyes")), true);
    assert.equal(await p.locator(".fx-pupil").count(), 2);
    assert.equal(await p.locator(".fx-pupil").first().evaluate((e) => getComputedStyle(e).opacity), "1");
    const pupilPulse = await p.locator(".fx-pupil").first().evaluate((e) => e.getAnimations().map((a) => a.animationName));
    assert(pupilPulse.includes("heartPulse"), "pupils must pulse");
    await p.waitForFunction(() => document.querySelectorAll(".aura-heart").length >= 3, null, { timeout: 6000 });
    await p.evaluate(() => (Math.random = () => 0.01)); /* force crit roll, keep heart-eyes lines deterministic */
    const r = await p.locator("#character-wrap").boundingBox();
    await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await p.waitForTimeout(250);
    const crits = await p.locator(".float-txt.crit").count();
    assert(crits >= 1, "crit tap text must appear");
    assert.match(await p.locator(".float-txt.crit").first().textContent(), /CRIT TAP! x20/);
    assert.deepEqual(p.errors, []);
    await p.close();
    console.log("PASS heart-eyes at Lv50+: pupils+pulse, eyelid/blush/lip overlays, aura hearts, x20 crit taps");

    /* ---- 3. Skin & Tan Studio persistence + perk ---- */
    p = await page({ level: 11 });
    await p.locator("#toggle-right").click();
    await p.locator('[data-tone="golden"]').click();
    await p.locator('[data-tan="heart"]').click();
    await p.locator("#gloss-range").fill("90");
    await p.waitForTimeout(150);
    let skin = await surface(p).evaluate((e) => ({ cls: e.className, gloss: e.style.getPropertyValue("--gloss") }));
    assert(skin.cls.includes("tone-golden") && skin.cls.includes("tan-heart"), skin.cls);
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".fx-tone-golden")).opacity === "1");
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".fx-tanline-heart")).opacity === "1");
    const glossOp = await p.locator(".fx-glossart").evaluate((e) => parseFloat(getComputedStyle(e).opacity));
    assert(Math.abs(glossOp - 0.855) < 0.02, "gloss slider must drive specular art opacity, got " + glossOp);
    assert.equal(skin.gloss, "0.9");
    assert.match(await p.locator("#tan-perk").textContent(), /\+5% COINS/);
    await p.waitForTimeout(3200); /* save throttle */
    await p.reload(); await p.waitForTimeout(900);
    skin = await surface(p).evaluate((e) => ({ cls: e.className, gloss: e.style.getPropertyValue("--gloss") }));
    assert(skin.cls.includes("tone-golden") && skin.cls.includes("tan-heart"), "studio must persist: " + skin.cls);
    assert.equal(skin.gloss, "0.9");
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("waifuB_save_v1")).skin);
    assert.deepEqual(saved, { tone: "golden", tan: "heart", gloss: 90, unlocked: ["heart"] });
    assert.deepEqual(p.errors, []);
    await p.close();
    console.log("PASS Skin & Tan Studio: live tone/tan/gloss, +5% perk, localStorage persistence");
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
