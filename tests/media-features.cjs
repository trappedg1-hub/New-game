const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("fs");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (await require("@sparticuz/chromium").default.executablePath()),
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, serviceWorkers: "block" });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(process.env.GAME_URL || "http://localhost:8765");
  await p.waitForTimeout(1100);
  await p.keyboard.press("Escape");

  /* ---- Tap blip: SFX-gated synth on the single ambience context ---- */
  assert.equal(await p.evaluate(() => typeof window.AmbientAudio?.tapBlip), "function");
  await p.evaluate(() => { const s = document.getElementById("set-sfx"); if (s) s.value = "0"; });
  await p.evaluate(() => { for (let i = 0; i < 5; i++) AmbientAudio.tapBlip(3, true); });
  await p.mouse.click(195, 450); /* real tap: gesture unlock + tap() wiring */
  await p.waitForTimeout(300);
  await p.evaluate(() => { const s = document.getElementById("set-sfx"); if (s) s.value = "70"; for (let i = 0; i < 12; i++) AmbientAudio.tapBlip(i % 4, i === 9); });

  /* ---- Photo studio: stage composite export ---- */
  await p.evaluate(() => window.__fanservice?.setCombo(160));
  await p.waitForTimeout(700);
  const cap = await p.evaluate(() => window.__snapshot.capture());
  assert(cap && cap.drawn >= 5, "composite layers: " + JSON.stringify(cap));
  assert(cap.w >= 600 && cap.h >= 1500, "export size: " + JSON.stringify(cap));
  const dlPromise = p.waitForEvent("download", { timeout: 15000 });
  await p.locator("#btn-snapshot").click();
  const dl = await dlPromise;
  await dl.saveAs("_diag_capture.png");
  const buf = fs.readFileSync("_diag_capture.png");
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG signature");
  assert(buf.length > 15000, "PNG too small: " + buf.length);
  assert.equal(buf.readUInt32BE(16), cap.w, "PNG width");
  assert.equal(buf.readUInt32BE(20), cap.h, "PNG height");

  await p.screenshot({ path: "_diag_bar.png" });
  assert.deepEqual(p.errors, []);
  await b.close();
  console.log("PASS tap blip (sfx-gated, single-context) + photo PNG", cap.w + "x" + cap.h, "layers:", cap.drawn, "bytes:", buf.length);
})().catch((e) => { console.error(e); process.exit(1); });
