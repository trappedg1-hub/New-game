# HERO-01 V3 — progress and recovery

## Current state

V3 remains isolated at `ArtStudio/Prototypes/hero01-interactive-v3/` on the fixed session branch `arena/680e6caa-new-game`. It is an expansion of the approved V1 baseline (`b260f1c`), not V2 or a new renderer. V1/V2 and Approved are protected.

The current source retains PixiJS **7.4.3**, two Pixi applications, the `51 × 149` original-image mesh, exact V1 idle/blink equations, all expressions and 13 mesh-following zones. Coordinated bounded 2D reactions now cover every zone; the head/eyes/expressions move together, hair follows with a delay, body and limbs have weighted shifts, and shoes remain anchored. Three physical variations and explicit interruption/return states are combined with the existing facial variations, cooldown and combos. The underlying artwork remains flat, not a skeletal rig.

The generated handless-face study is experimental, unapproved, and unused by the runtime; independent fingers and convincing 3D turns are not implemented. See `README.md` and `artifacts/PROVENANCE.md` for the mapping and limitations.

## Production deployment

- Public **production**: https://hero01-interactive-v3-prototype.vercel.app/
- Separate project `hero01-interactive-v3-prototype` (`prj_6ohITCsTvMMgxMtf8jYPPXzTb5q7`). Before the current full-body expansion, the promoted deployment was `dpl_Dd5Qi6fHdg9sUQWisWbBRXrTe5Pq` from `683f09cf9e5076a7bed253dffbfb2cb956fa57ee`; its verification is recorded in prior Git history. The expansion must pass new WebKit checks before updating this project.

## Expansion verification in progress

- 20/20 unit tests, original expression asset check, build and audit passed. Chromium desktop, iPhone-sized portrait and landscape passed V1 buffer comparison, all 13 real pointer/touch zones, actual WebGL physical changes, expressions/blink on a moving head, interruption, controls and recovery. Native Chromium swipe scrolls; tap, pinch, stationary two-finger contact and double-tap checks passed on the canvas. See `QA.md`.
- The new build's WebKit portrait/landscape runs and deployed-public checks are pending; old WebKit results are not evidence for the expansion. Real iPhone Safari and native WebKit swipe/pinch have not been tested.
- The aligned hand/face underpaint candidate was not integrated because seamless independent motion is not established. V1 blink can visibly flatten eyes mid-blink; high-zoom expression transitions can show brief softness/ghosting.
- Approved source SHA-256 remains `91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd`; the final V1/V2/Approved tree must be compared against the saved baseline before delivery.

## V1/V2 deployment safety

V1 production: https://hero01-idle-prototype.vercel.app/, deployment `dpl_DJ6ou9Bqx6VfW1uhf7PLYfmyVvDm`. V2 production: https://hero01-idle-v2-prototype.vercel.app/, deployment `dpl_8DRApt5WKiiMsqzPtCxTDgokCdZE`. Their separate projects and Approved are not the V3 target.
