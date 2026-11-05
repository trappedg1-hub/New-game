// Opt-in browser benchmark. This reports the test host's rAF cadence only;
// an iPhone viewport/user-agent in a desktop engine is not real iOS Safari.
import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright-core';

const engine = process.env.HERO_BROWSER || 'chromium';
const type = engine === 'webkit' ? webkit : chromium;
const options = { headless: true };
if (engine === 'chromium') {
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  options.args = ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  if (process.env.CHROME_PATH) options.args.push('--no-zygote', '--single-process', '--in-process-gpu');
}
const seconds = Math.max(3, Number(process.env.HERO_PERF_SECONDS || 8));
const url = new URL(process.env.HERO_TEST_URL || 'http://127.0.0.1:5173/');
url.searchParams.set('qa', '1');
const browser = await type.launch(options);
try {
  const context = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: engine });
  const page = await context.newPage();
  await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => window.__HERO_QA__, null, { timeout: 45000 });
  assert.equal(await page.locator('#error-message').isHidden(), true);
  await page.locator('#animated-view').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  for (const mode of ['idle', 'reaction']) {
    const result = await page.evaluate(({ mode, seconds }) => new Promise(resolve => {
      window.__HERO_QA__.resume();
      const times = []; let start = performance.now(), lastTrigger = -1000;
      function sample(now) {
        if (now - start >= seconds * 1000) {
          const gaps = times.slice(1).map((time, i) => time - times[i]).sort((a, b) => a - b);
          const canvas = document.querySelector('#animated-view canvas');
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          const debug = gl?.getExtension('WEBGL_debug_renderer_info');
          resolve({ mode, frames: times.length, seconds: (now - start) / 1000,
            fps: times.length / ((now - start) / 1000), medianFrameMs: gaps[Math.floor(gaps.length * 0.5)],
            p95FrameMs: gaps[Math.floor(gaps.length * 0.95)], canvas: [canvas.width, canvas.height],
            glRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'not disclosed', userAgent: navigator.userAgent });
          return;
        }
        if (mode === 'reaction' && now - lastTrigger > 650) {
          window.__HERO_QA__.trigger(['armLeft', 'armRight', 'legLeft', 'legRight'][Math.floor((now - start) / 650) % 4]);
          lastTrigger = now;
        }
        times.push(now); requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }), { mode, seconds });
    console.log(`${engine} iPhone-sized *emulation* ${JSON.stringify(result)}`);
  }
} finally {
  await browser.close();
}
