# CURRENT: true registered layers; no SVG warping

- Removed all displacement/turbulence SVG primitives, motion fields, procedural skin-oval eyelids and warp/tap-jump controllers from the runtime.
- All FIVE base tiers now use five independently generated registered PNG components: body_base, hair_back, face_open, face_closed, hair_front. Tier 2 was re-reviewed in isolated component and full-composite contact sheets after cleanup; its existing clean parts are now enabled. This supersedes its earlier quarantine, not a blind manifest status flip.
- `tools/prepare_layered_runtime.py` reruns the immutable-source PIL cleanup, publishes named open/closed face aliases and reconstructs the runtime manifest. Manual head polygons cover Tier 4's kneeling head at y625+, NOT an unsafe generic top-15% rectangle. Body alpha/outside-head pixels are preserved. All body cores are smooth gradients; isolated bodies/hair and complete composites were visually inspected. Pixel/color heuristics are not general semantic certification or a mathematical guarantee for future assets.
- Face pair non-eye RGB/alpha are identical. Exclusive step-end opacity swaps close for 150ms every 4.5 seconds: exactly one visible complete face, never crossfaded. Both share the body's breathing parent and registration. Hair groups use 5.5s ±0.4deg back / 4.2s ±0.8deg and ±1.5px front transforms; accepted taps react only on their isolated wrappers. No pixel distortion, skew, body jumping or artificial local chest/hip warping.
- All SEVEN non-base costumes now have registered independently generated body/back-hair/front-hair/two-face sets. Original full images remain only as load-safe source assets, not normal costume rendering. Generated faces/hairstyles may differ from original art. No independent cloth/chest deformation is claimed.
- Costume registration scripts (`tools/register_{cardigan,track,apron,maid,pool,gown,bunny}.py`) align independently generated parts; remove duplicate blank skull/accessories, preserve neck and lock finite eye-only patches. Per-outfit JSON records canvas and blink support. Original candidate PNGs and keyed intermediates stay in the workspace, excluded from Git/deploy; only 35 final PNGs, registration reports and generators are shipped. Rebuilding requires retained candidate inputs.

- Hair attachment pivots are measured from each registered face in canvas coordinates (`tools/update_hair_pivots.py`), shared by idle and tap wrappers. Bunny ears and Tier 4 viewport no longer cause rotation around the canvas edge. `tests/rig-controls.cjs` covers all 12 pivots, quick swaps, Motion OFF/reduced motion and failed layer loads preserving the previous complete rig. No new art generated for this refinement.
- Ground: 2% stage-floor padding, alpha-derived contact points, 200px-max/16px radial shadow + tiny contact spots; resize preserves each rig's aspect, including Tier 4 viewport. Scene grading remains CSS color correction only.
- Scene matrix kept: classroom/cafe/private pool/bedroom/private sunset beach; costume selections change background, lighting and contextual dialogue. Track uses resort in Tier 3. Outfit ownership enables selection at any level; it changes scene context, not XP. Nightgown always selects bedroom. No added fictional Lingerie or Event Dress inventory entry.
- Scene/background/lighting/ambient profile commit only after the winning rig's five PNGs decode and mount. A pending, superseded or failed costume load does not change the previous visual scene. Cached same-art mounts still commit context (e.g. relationship-dependent Track scene). Equip-specific dialogue is deferred to commit. `tests/scene-commit.cjs` exercises delayed and aborted layers via actual wardrobe clicks at mobile/desktop widths.
- Ambient audio: quiet synthesized noise profiles per environment, Music volume control, starts only after a user gesture; muted in hidden tabs. These are synthetic beds, not recorded cafe/wave soundtracks.
- Tests: `tests/layer-pixels.py`, `tests/true-layers.cjs` (mobile/desktop true rigs, 2-frame blink, 0px shared registration, hair transforms, 2% ground, safe costume swaps, scene matching, cancellation, reduced motion), smoke/gacha/admin. Native device performance not certified.
- Cache v25. Historical notes below are superseded.

---
# Local secondary motion replaces whole-character jumping

- Removed the parent WAAPI tap bounce entirely. Accepted taps now excite bounded damped local fields for hair, chest, hips and fabric. Hair/hips/fabric have different delays and frequencies; the character root never jumps.
- Up to six recent impulses are retained with amplitude clamping, so rapid tapping does not restart every oscillator at zero or cause runaway deformation. Switching art clears previous impulses.
- Per-art elliptical motion zones are recorded for all 12 illustrations in `tools/build_presentation.py` / `data/character-presentation.js`. Long skirts, short skirts, hoodies, sarong and swimwear have different fabric zones; swimwear has only subtle garment response.
- Three static SVG displacement fields operate on the same single PNG, following the hair field. Idle torso/hip/fabric movement continues without taps. No sliced PNGs, second face or second DOM character image. This is stylized procedural 2D warping, NOT a skeletal/Live2D rig or actual simulated garment geometry.
- `tests/local-motion.cjs`: independent time-varying response across all 12 art on mobile/desktop, zero parent jump, bounded ten-tap burst, motion off/on. Existing single-art, visible-motion, scene/grounding, smoke, gacha/admin tests retained.
- Cache v15 refreshes the filter chain and per-outfit zone metadata together.

# Visible motion correction

- Hair no longer depends on SMIL/baseFrequency playback. One requestAnimationFrame driver advances the SVG noise offset at ~30 updates/s; fixed displacement scale 10 keeps the neutral map outside the hair perfectly stationary.
- Wind survives costume changes, motion toggle, reduced-motion preference changes and tab visibility changes. No motion override of user accessibility preferences.
- Shared surface breathing now uses bottom-anchored scaleY 1.012 and -1px vertical rise over 3.8s, visibly stronger without moving facial parts independently.
- tests/visible-motion.cjs verifies real elapsed transform/wind changes for all 12 illustrations at mobile/desktop widths, including stop/resume. A browser screenshot pixel comparison with breathing/overlays/background disabled found changed pixels in the hair region and exactly zero changes in the lower half.
- Cache v14 refreshes the corrected CSS/JS/SVG together. Single image, facial registration and ground plane remain intact.

# Current presentation: grounded single-PNG scenes + localized procedural effects

- Still exactly one complete `img#character-art`; no body/hair/face image stack. Its measured surface contains tiny CSS eyelids, not duplicate facial PNGs.
- Ground plane: 3% above stage floor at all breakpoints. Alpha-derived contact points and bottom bounds from each native original drive contact shadows. ResizeObserver fits the original aspect ratio. `overflow: clip` prevents hidden stage scrolling when interacting with rails (previously could move the character/background by 15px).
- Environments: base tiers = classroom / café / newly generated private pool / existing warm bedroom / private sunset beach. Rooftop no longer appears in the default progression. Outfit tags select their matching environment, lighting and contextual idle/tap dialogue without changing XP, ownership or relationship level. Track Star uses the pool/resort when the relationship is Tier 3, otherwise the school context. Owning an outfit permits choosing it at any level, but never in an unrelated background.
- All seven costume choices plus the base wardrobe entry remain available through normal ownership rules; no imaginary eighth non-base costume or event dress was created.
- Hair sway uses one SVG displacement filter whose noise is spatially restricted to a feathered upper-hair zone and excludes the face; a neutral map leaves the remainder unchanged. Approximation, not individual strand simulation.
- Eyelids: manually recorded visible-eye landmarks for all 12 full illustrations, skin-tinted ovals with a closed-lash curve, 150ms every 4.5 seconds. Eyes hidden by hair are not duplicated. These are a stylized procedural approximation, not newly painted blink frames. Skin color was tuned after visual review; exact native painted anatomy is not certified by opacity tests.
- Breathing (3.8s) and eyelids share one surface, with tap bounce on its parent; all share scene lighting. Ambient rim tint is clipped to the full illustration alpha via CSS mask. No rectangular glow/image clone.
- New pool background: `assets/backgrounds/bg3_private_pool.{png,webp}`. Landmarks: `data/character-presentation.js`, reproducible with `tools/build_presentation.py`. Manifest v8 adds environment/procedural metadata; full PNGs remain the same upscaled originals.
- Tests: four-width presentation grounding/matrix/lighting/blink-cycle suite; stale-load and failed-load protection; all-tier/outfit single-art/tap tests; gacha/SSR and local admin regressions; DOM smoke checks. Browser/headless tests, not native-device performance certification.

---
## Earlier implementation notes (historical)

# Current renderer: SINGLE ART ONLY (supersedes all historical layered notes below)

- All five tiers and seven costumes use `type: "single"` in manifest v7.
- `#char-container` contains exactly one persistent `img#character-art`. No face, blink, cloth or hair DOM layers, A/B stacks or layered renderer remain.
- `assets/characters/single/*.png`: whole original PNG illustrations resampled to 4096px high with Lanczos. These are upscaled originals, not native 4K detail. Native originals are retained unchanged. Bright green key fringe is removed from Tier 3 during this reproducible build.
- Breathing runs on the image, 4s ease-in-out; accepted taps animate only its parent via cancellable WAAPI. Reduced-motion and motion-off stop animation.
- New art decodes before assigning the same image's src, then fades from 0.35 to 1 over 300ms. There is no blank frame or outgoing duplicate. Stale async requests cannot win; failed requests retain the last good image.
- Old layered asset directories remain historical unused files, not primary art or precached resources. Old layer-specific tests have been replaced by single-art coverage.
- Gacha (including SSR reveal FX), wardrobe, saves and the local admin tools remain intact.
- Current tests: `tests/character-animation.cjs`, `tests/single-art.cjs`, `tests/gacha.cjs`, `tests/admin.cjs`, `tests/smoke.cjs`.

---
## Historical implementation notes (not the current runtime)

## Latest safety status: asset-content cleanup and Tier 2 quarantine

**Tier 2 is now a clean whole-image fallback**, not a layered rig. Its candidate paths are moved out of runtime `layers` into `candidateLayers`; the original 421×1185 whole-image canvas is restored. `contentAudit.status: quarantined` prevents the renderer from mounting candidates even if someone accidentally toggles status back to layered. All required part paths must also be present before any rig mounts. Tiers 1/3/4/5 remain layered after cleanup and visual review; costumes retain their previous whole-art fallbacks.

`tools/clean_layer_content.py` reproducibly reads the pre-cleanup assets from revision `ee756bd`, samples forehead skin tone, and repaints the body-head regions with a smooth featureless gradient while retaining the original alpha silhouette. It checks both hair images within a head-region margin and clears conservative warm skin/amber/red residue pixels, preserving purple/pink hair highlights rather than broadly deleting every non-purple edge. All five tiers' body/back/front PNGs were processed. `assets/characters/layer-content-audit.json` records the source revision, sampled tones and removal counts. No new AI images were generated.

Inspection of the current assets did not conclusively identify a second complete baked eye/mouth set; body nose/highlight remnants and warm edge residues were present. A color heuristic is **not semantic certification** of a clean face separation. Because the reported Tier 2 defect is unresolved at that level, it stays quarantined instead of claiming that opacity tests or color cleanup prove its layered rig safe. Its original whole image was separately inspected and is what players receive. Full body/hair sheets, head composites and real-browser runtime screenshots for all five tiers were reviewed after cleanup.

Tests: `tests/layer_content.py` verifies smooth repainted head cores, unchanged body alpha, untouched pixels outside cleanup regions, no remaining warm-color detections in checked hair zones, and Tier 2's empty runtime layers/quarantine. Renderer unit tests explicitly try to bypass quarantine by changing status to layered and confirm that it still mounts only the fallback. Single-face/browser registration suites now explicitly check the Tier 2 fallback has one image and zero face overlays, rather than skipping it or incorrectly expecting five layered tiers. Pixel blink, hair-depth, rapid-tap/touch/low-end, gem-gacha and smoke suites pass. Browser screenshots confirm one face in each current runtime tier; native-device QA remains unverified.

Run the content cleanup after any earlier registration scripts, which otherwise restore pre-cleanup candidate assets. Do not re-enable Tier 2 without a new visual separation/registration review. Earlier delivery notes below are historical and superseded by this safety status.

---

## Latest bugfix: exclusive face visibility

The current renderer supersedes the earlier masked-eyelid overlay: it uses **one full open face OR one full closed face**, never both. `.layer-face-blink` defaults to opacity 0. Complementary five-second step-end animations close for 150ms (94–97% of the cycle) with no overlapping crossfade frames. Both PNGs retain identical registration, alpha silhouette and non-eye pixels; the shared body/breath/tap chain stays unchanged. A discrete eye-state switch is deliberate: a linear crossfade necessarily renders both sets of eye features at once.

Startup no longer mounts a second rig in the inactive character slot. `CharacterAnimation.unmount` clears inactive DOM and invalidates pending decode callbacks. Wardrobe/tier character swaps are atomic (background crossfades remain), so outgoing and incoming heads cannot overlap; only one open/closed pair exists globally while a layered character is active. Whole-image costumes have zero extra face layers. No entrance opacity fade runs on full-rig replacement.

`tests/single-face.cjs` checks exact [1,0]/[0,1] states at default, blink boundaries and the next loop across all five tiers; exactly one open/closed pair; taps; all seven real wardrobe costume swaps; return to the base outfit; and no stale inactive images. Renderer unit tests verify unmount cancels pending async installation. Body/face registration tests still report 0px relative geometry drift. Rapid-tap, touch, low-end, pixel, hair, gacha and smoke suites pass. All collectible costumes currently use whole-art fallbacks, so there are no complete layered costume rigs to claim tested.

---

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

## Face registration / melting bugfix

Removed the independent Tier 4/5 face head-tilt animation and the tap face-filter pulse. Body, open face and closed-eye overlay now inherit exactly the same center-bottom breathing, hip and WAAPI body bounce chain. The shared breathing wrapper is explicitly named `layer-synced`; no duplicate per-image breathing clocks are used. Hair retains its separate sway and reaction wrappers. Both face images explicitly have z-index 4 and no local transforms.

All five closed-face PNGs were rebuilt with the unchanged open face as base, retaining exactly the same alpha silhouette, jaw, mouth and pixels outside the manifest's finite `blinkRegions`. Generated eyelids were registered to the open-eye baselines; Tier 1 now uses both actual closed eyelids from its independently generated source rather than the previous one-eye patch. The small source-eye crop is retained at `tools/animation-reference/tier1-closed-eyes.png` for reproducibility. `tools/lock_blink_faces.py` uses the known pre-fix revision for other generated blink sources. Run it after re-registering source components.

To avoid mid-blink skin translucency, the open face remains fully opaque throughout; the closed-eye PNG is masked to only the two eye regions with a canvas-coordinate SVG mask and opacity-faded over it. Whole heads are no longer crossfaded. Default closed-eye opacity remains zero, low-end/reduced-motion modes show the open face, and open/closed PNGs remain full 420×1323 registered RGBA assets.

Verification: `tests/face_pixels.py` checks all five canvases, exact alpha/head bounding-box equality, and byte-identical non-eye pixels. `tests/face-registration.cjs` samples the full 8-second idle cycle and blink timing across all five tier swaps: body/open-face/closed-face DOM geometry has **0px relative delta**, with no face-only animation, transform or filter. `tests/tap-animation.cjs` now checks that equality on every sampled rapid-tap frame, in addition to no disappearing frames, stable idle clocks, no residual effects and one-count touch input. All six tap scenarios pass. Renderer unit, game smoke, hair-depth and gem-gacha suites also pass. Face-only pixel comparisons were visually reviewed; native-device certification is not claimed.
