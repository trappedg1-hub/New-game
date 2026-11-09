# Independent character animation / status

## Delivered assets

The image service permitted **10 images in this turn**, not the requested 30.

| Tier       | Runtime mode | Assets / reason                                                                                                                                                                                                                           |
| ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Stranger | Layered      | Six independently AI-generated components; five enabled. Separate body, back hair, front hair, open face, closed eyelids. Cloth candidate retained but disabled: Stranger calls for no flutter and its generated waistband did not align. |
| 2 Friend   | Fallback     | Four independently generated candidate components (body/back hair/front hair/open face). Closed face and loose cloth requests were rejected by the service limit. Incomplete rig is NOT enabled.                                          |
| 3 Close    | Fallback     | No image budget remained. Original painting retained.                                                                                                                                                                                     |
| 4 Intimate | Fallback     | No image budget remained. Original painting retained.                                                                                                                                                                                     |
| 5 Devoted  | Fallback     | No image budget remained. Original painting retained.                                                                                                                                                                                     |

All seven collectible costumes retain whole-art fallbacks. Gown and Bunny retain SSR UI lighting. No claim is made that these are Live2D meshes or that the other four tiers have independently moving anatomy.

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
- True blinking exists only on Tier 1. Fallbacks use a very small opacity pulse, not moving eyelids.
- Optional cloth animation support is implemented, but **no cloth overlay has passed registration and been enabled yet**.
- Service worker cache updated for offline rig loading.

## Verification

Browser tests at 390px and 1440px checked Tier 1 installation, body/hair/blink animations, closed-eye visibility at 4.8s, tap reactions, all five tier art selections and ordinary tap earnings. Simulated eight-core/two-core tests verified full rig versus breathe-only modes. Hidden-tab pause was tested by visibility-state simulation. Pixel canvas/alpha/path validation passed. Unit tests cover same-source preloads and stale-load cancellation.

Tests: `node tests/character-animation.cjs` and `node tests/smoke.cjs` (requires jsdom).

Actual native-phone 60fps and Live2D-quality deformation are **not certified**. This is one complete generated-part rig and four explicit fallbacks, not the requested five complete rigs.
