# Current delivery status — final tiers and gem gacha

All five relationship tiers now use five independently generated registered components, RGBA **420×1323**. Tier 2's four existing candidates were reprocessed and registered; its old face candidate contained a dressed figure, so only the head of that independently generated component was retained. A newly generated closed face supplies the eyelid patch. Tier 5 has five new independent components. Original whole-character art was not sliced into parts. `tools/register_final_tiers.py` reproduces preparation. Browser review corrected a Tier 2 scalp gap; new tiers retain distinct front/back motion and masks.

| Runtime asset | Status |
|---|---|
| Tiers 1–5 | All layered; five enabled parts each |
| Silk Nightgown | Whole-art fallback with existing SSR gold lighting; three 420×1323 candidates saved under `assets/characters/costume_gown/` |
| Other collectible costumes | Existing whole-art fallbacks |

The service counted a failed Tier 5 body request against its 10-request budget. The body retry succeeded. **Nine successful images** this turn: six required tier components plus three Nightgown parts (body/back/front hair). The Nightgown open-face request was rejected by the limit; both its open and closed faces remain pending. Incomplete candidates are recorded in the manifest, never mounted as a broken rig. No additional image calls were attempted after the limit response.

## Gem gacha

The existing accessible left-menu Gacha modal is now explicitly labeled “Gacha 🎰” and shows its banner, pool, rates, gem balance, pity, paid x1 at 100 gems, paid x10 at 900 gems, and a separate free x1 button with a rolling 24-hour cooldown. Paid pulls do not consume the free claim or energy. Draw outcomes, ownership, duplicate coin rewards and pity are persisted before the reveal animation. Cards rotateY-flip over 800ms with NEW! badges, duplicate rewards, and SSR gold lighting/confetti/brief WAAPI shake. Draws unlock the wardrobe immediately; existing owned outfits and saves are retained.

Pool clarification: the requested N/R/SSR list contains no SR outfit despite a 9% SR rate. N is Cardigan/Track Star/Café Apron, R is Maid/Poolside, SSR is Silk Nightgown/Midnight Bunny. SR draws are explicitly labeled upgraded Maid/Poolside cards, unlocking those same wardrobe IDs and paying SR duplicate rewards. This interpretation is disclosed in the modal. SR-or-better is guaranteed by draw 10; SSR is guaranteed by draw 50 and takes priority. Natural SSR remains possible at the SR-pity threshold. This is a local game-currency draw system, not a payment service.

## Current verification

- Renderer unit tests and game smoke tests pass (360/390/414/1280).
- PNG audit: all 25 enabled tier paths exist, RGBA 420×1323, transparent alpha, and distinct open/closed faces.
- Hair regression checks now pass with **all five tiers layered**.
- Tap regression tests cover full motion Tiers 1–5, touch/mouse, blink opacity complementarity, idle clock continuity, no disappearing frames, no residual transforms, and two-core mobile breathing-only plus bounce.
- Gacha browser tests cover gem prices and x10 discount, energy unchanged, separate free claim/cooldown, duplicate payout, NEW badge, immediate collection unlock, SR@10/SSR@50, persistence across reload, insufficient funds, SSR confetti, and equipping the Nightgown as an atomic whole-image SSR fallback.
- Native-device 60fps and Live2D mesh deformation remain unverified/not claimed.

The sections below are historical batch records, superseded by this current status.

---

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

## Tap disappearance bugfix

Tap reactions now use Web Animations API effects on dedicated body/hair reaction wrappers, plus a face filter pulse. They never replace idle CSS animations, touch blink opacity, or restart the rig's entrance fade. Rapid taps retarget from the current visible reaction pose and cancel only the preceding reaction effect. Completed effects leave no persistent transforms. Accepted game taps invoke the renderer once; no second pointer/keyboard listener duplicates touch/click reactions. Economy formulas are unchanged.

All rig parts now share one center-bottom breathing wrapper. Hair pivots use top-center, adjusted to the head position for padded kneeling art. Hidden tabs cancel transient effects; reduced motion suppresses reactions; low-end mode keeps the body bounce with breathing only. Legacy `.char-tap` selectors and tap keyframes have been removed.

Regression: `tests/tap-animation.cjs` runs a real Chromium browser against `GAME_URL` (default local preview port 8765). Four scenarios (layered tiers 1/3/4, fallback tier 2; mouse/touch; 8/2 cores) each verify ten rapid taps, exactly ten earnings events and reactions, no hidden ancestor/body frames, unchanged CSS animation identities/start times, zero residual WAAPI effects, and tier swapping. Blink transition samples verify open/closed opacity sums to one. All scenarios, renderer unit tests, and game smoke tests pass. This bugfix is authorized for immediate deployment, superseding the earlier hold for five completed rigs.

## Duplicate hair bugfix

Idle back hair is now 5.5s, ±0.3deg / ±0.5px, no delay, normal direction. Front hair is 4s, +0.8 to -1deg / +1 to -1.5px, delayed 0.8s, reverse direction. Motion remains on nested sway wrappers, not the PNGs, preserving WAAPI reaction isolation. Front tap whips -4deg/+2deg with 4px lift for 600ms; back tap only rotates -1deg for 700ms.

Explicit stacking contexts enforce back curtain < body/cloth/face < front hair. Per-rig manifest `hairBackReveal` coordinates mask redundant back crowns while retaining the lower rear curtain behind the body. The mask uses the original layer canvas, including Tier 4's padded head position, with WebKit and standard CSS mask declarations. No blanket bottom fade removes the real back curtain. Tier 3's front component contained a detached rear curl; `tools/clean_front_hair.py` removes only that disconnected component, retaining the front bangs/locks and their antialiased edges. Run this cleanup after re-running `register_more_layers.py`.

`tests/hair-animation.cjs` verifies all five tier modes, three layered rigs' distinct CSS timing/direction and sampled transforms, masks, stacking contexts, and asymmetric WAAPI tap keyframes. Tiers 2/5 are explicitly checked as single-image fallbacks. Desktop screenshots for all five were reviewed; no extra crown or detached duplicate rear curl remains in the layered composites. Tap-spam, idle clock stability, touch single-fire, low-end bounce, blink transition, renderer unit and smoke tests also pass. Tests use Chromium; native-device rendering remains unverified.
