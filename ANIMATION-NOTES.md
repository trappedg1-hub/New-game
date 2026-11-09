# Independent character animation / status

## Delivered assets

Two generation batches produced 20 independent component images total. The continuation batch used its 10-image budget to complete Tier 3 and Tier 4 first, per priority. Tier 2 and Tier 5 remain pending. Do not deploy this intermediate batch: the user requested deployment only when all five tiers are layered.

| Tier       | Runtime mode | Assets / reason                                                                                                                                                                                                                           |
| ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Stranger | Layered      | Six independently AI-generated components; five enabled. Separate body, back hair, front hair, open face, closed eyelids. Cloth candidate retained but disabled: Stranger calls for no flutter and its generated waistband did not align. |
| 2 Friend   | Fallback     | Four independently generated candidate components (body/back hair/front hair/open face). Closed face and loose cloth requests were rejected by the service limit. Incomplete rig is NOT enabled.                                          |
| 3 Close    | Layered      | Five independently generated components: body, back hair, front hair, open face and closed-eye face. 420×1323 RGBA.                                                                                                                                                                                     |
| 4 Intimate | Layered      | Five independently generated components: body, back hair, front hair, open face and closed-eye face. 420×1323 RGBA; kneeling pose letterboxed, viewport crops transparent padding at runtime.                                                                                                                                                                                     |
| 5 Devoted  | Fallback     | No image budget remained. Original painting retained.                                                                                                                                                                                     |

All seven collectible costumes retain whole-art fallbacks. Gown and Bunny retain SSR UI lighting. No claim is made that these are Live2D meshes or that the fallback tiers have independently moving anatomy.

Machine-readable source of truth: `assets/characters/animation-manifest.json`.

## Art preparation

Tier 1 candidates were generated independently, NOT sliced out of the previous whole illustration. Generation did not honor actual alpha or exact requested resolution. Matte cleanup, registration and resampling were necessary. `tools/prepare_animation_layers.py` records the operation. Source candidates are kept outside Git at `/home/user/layer-candidates`.

All six Tier 1 outputs are RGBA, 420×1323, with shared canvas coordinates. The blink generator returned an extraneous second head, which was discarded. The generated closed-eyelid region is composited over the open-face silhouette so the jaw and mouth do not jump during blinks. Back/body/face/front overlap rather than meeting at rectangular cut seams. Tier 2 candidates are RGBA on the original 421×1185 canvas but have NOT passed complete-rig registration.

## Renderer

`js/character-animation.js` is a presentation-only module; `mountArt` in `game.js` delegates to it. The economy, levels, rewards and save formulas were not changed. Nested transform wrappers allow breathing, hair motion, blink opacity and tap reactions to coexist without overwriting one another.

- Complete layer sets decode before atomic installation; missing/failed layers retain the complete original painting.
- A generation token prevents old asynchronous loads replacing a newer costume/tier.
- Five tier intensity classes and reactions are available for layered/fallback renderers.
- On mobile with fewer than four reported CPU cores, only breathing runs.
- Reduced motion shows open eyes; hidden tabs and invisible crossfade slots pause animation.
- True blinking exists on Tiers 1, 3 and 4. Fallbacks use a very small opacity pulse, not moving eyelids.
- Optional cloth animation support is implemented, but **no cloth overlay has passed registration and been enabled yet**.
- Service worker cache updated for offline rig loading.

## Verification

Browser tests at 390px and 1440px checked Tier 1 installation, body/hair/blink animations, closed-eye visibility at 4.8s, tap reactions, all five tier art selections and ordinary tap earnings. Simulated eight-core/two-core tests verified full rig versus breathe-only modes. Hidden-tab pause was tested by visibility-state simulation. Pixel canvas/alpha/path validation passed. Unit tests cover same-source preloads and stale-load cancellation.

Tests: `node tests/character-animation.cjs` and `node tests/smoke.cjs` (requires jsdom).

Actual native-phone 60fps and Live2D-quality deformation are **not certified**. This is three complete generated-part rigs and two explicit fallbacks, not the requested five complete rigs.

## Continuation batch: Tiers 3 and 4

`tools/register_more_layers.py` reproduces chroma keying, despill, face registration and blink compositing from the ten new independent AI source components in `/home/user/layer-candidates/tier3` and `tier4`. No original full-image parts were sliced. Optional cloth is omitted in this batch.

All ten delivered PNGs are transparent RGBA 420×1323. Tier 4 preserves kneeling anatomy with transparent top padding; manifest `viewport: [0,617,420,706]` makes the renderer show the content area at useful size without changing layer registration or stretching the figure. Tier 1 files remain untouched.

Open and closed composites were visually reviewed. Browser checks on simulated 8-core mobile verified both new rigs have decoded 420×1323 layers, breathing, separate front/back hair animations, open/closed opacity [0,1] at blink time, and tap reaction. Low-end mobile tests verified breathing-only behavior. Existing unit and smoke tests pass. Animation tests now read expected mode from the manifest instead of assuming tiers 2–5 always fallback. Native phone performance remains unverified.

Next generation batch: complete Tier 5 five-part rig, then generate Tier 2 closed face only and register the existing four Tier 2 candidates to 420×1323. Validate all five layered, then deploy. Current deployed URL still points at the preceding Tier-1-only revision until that final deployment.
