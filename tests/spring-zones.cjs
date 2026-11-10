const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (await require("@sparticuz/chromium").default.executablePath()),
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const url = process.env.GAME_URL || "http://localhost:8765";
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, serviceWorkers: "block" });
  p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message));
  await p.addInitScript((s) => { if (!localStorage.getItem("waifuB_save_v1")) localStorage.setItem("waifuB_save_v1", JSON.stringify(s)); }, {
    v: 1, level: 10, gems: 0, lastSeen: Date.now(),
    streak: { last: new Date().toISOString().slice(0, 10), count: 1 },
  });
  await p.goto(url); await p.waitForTimeout(1200); await p.keyboard.press("Escape");

  /* --- hit-area zones (Live2D-style) --- */
  const wrap = await p.locator("#character-wrap").boundingBox();
  const clickAt = async (fy) => { await p.mouse.click(wrap.x + wrap.width / 2, wrap.y + wrap.height * fy); await p.waitForTimeout(280); };
  await clickAt(0.12);
  assert.equal(await p.evaluate(() => window.__fanservice.zone), "head", "top taps must hit the head zone");
  await clickAt(0.55);
  assert.equal(await p.evaluate(() => window.__fanservice.zone), "waist", "middle taps must hit the waist zone");
  await clickAt(0.9);
  assert.equal(await p.evaluate(() => window.__fanservice.zone), "legs", "low taps must hit the legs zone");
  console.log("PASS hit-area zones head/waist/legs from tap coordinates");

  /* --- spring physics: bounce applies, then settles to identity --- */
  await clickAt(0.55);
  const kicked = await p.waitForFunction(() => {
    const el = document.querySelector(".rig-breath");
    return el && el.style.transform !== "";
  }, null, { timeout: 1500 }).then(() => true).catch(() => false);
  assert.equal(kicked, true, "tap must kick the spring transform on .rig-breath");
  await p.waitForFunction(() => {
    const el = document.querySelector(".rig-breath");
    return el && el.style.transform === "";
  }, null, { timeout: 3000 });
  console.log("PASS spring bounce on shared breath wrapper settles to identity (zero drift)");

  /* --- ASMR sigh API exists and is safe to call --- */
  assert.equal(await p.evaluate(() => typeof window.AmbientAudio?.sigh), "function");
  await p.evaluate(() => { window.AmbientAudio.sigh(); window.AmbientAudio.sigh(); });
  await p.waitForTimeout(200);
  assert.deepEqual(p.errors, []);
  console.log("PASS binaural sigh API guarded and error-free");
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
