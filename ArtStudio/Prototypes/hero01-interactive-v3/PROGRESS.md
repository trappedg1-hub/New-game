# HERO-01 V3 — progress and recovery

## Current state

V3 is being developed separately in `ArtStudio/Prototypes/hero01-interactive-v3/` on the fixed session branch `arena/680e6caa-new-game`. The session does not permit creating a separate branch; this directory is the isolation boundary. Starting repository commit: `71eb43301b9678e63b70861048cd15ea9f0d349c`.

V1 is `ArtStudio/Prototypes/hero01-idle/`: source `src/rig.js` copied byte-for-byte into V3. It uses PixiJS **7.4.3**, Vite 6.4.5, a 51 × 149 Pixi SimplePlane over the unchanged 1184 × 3488 approved artwork, two Pixi applications for original/animated comparison, localized open/underpaint/closed eye sprites, one `requestAnimationFrame` timeline and responsive root transforms. Body, hair, clothing and background are one flat mesh, not independently occluding layers. V1 production is https://hero01-idle-prototype.vercel.app/, project `hero01-idle-prototype` with production branch `main` and deployment `dpl_DJ6ou9Bqx6VfW1uhf7PLYfmyVvDm` from commit `f3ef0305b55f1b802051915732845ade2ac73cc7`; no V1 settings were changed. V2 remains a separate experiment.

Baseline: V3 copy installed successfully, `npm test` passed 5/5, `npm run build` succeeded and copied `src/rig.js` matched V1 SHA-256 `d683fa8dbfe87f01ba041652c46fa96c3e626a399ec291b4bf51ecbf6d25fef0`. Approved artwork SHA-256 is `91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd`.

## Incomplete

No V3 interaction, expression controller, hitboxes, mobile interaction QA or V3 deployment is complete yet. Experimental facial studies may exist locally, but must be aligned, masked, inspected and integrated without modifying V1, V2 or approved assets. Do not treat the V1-copy build as a completed V3.

## Next steps

1. Prepare localized experimental facial layers from matching studies; retain V1 blink untouched in neutral.
2. Implement separate transformed Pixi hit polygons, pointer/touch cancellation and a debug overlay.
3. Add a bounded reaction state machine and additive motion over V1's exact idle mesh; keep the V1 controls.
4. Compare V1/V3 rendered idle frames; test all zones, expressions, reactions, mobile WebKit and deployment separately.
