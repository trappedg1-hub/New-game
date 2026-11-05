# HERO-01 V3 — progress and recovery

## Current state

V3 is isolated at `ArtStudio/Prototypes/hero01-interactive-v3/` on fixed session branch `arena/680e6caa-new-game`. A new dedicated branch is not permitted in this session. Original repository starting commit: `71eb43301b9678e63b70861048cd15ea9f0d349c`; V3 baseline-copy commit: `b260f1c`.

Implementation is present: V1 PixiJS 7.4.3 `51 × 149` shared mesh/idle/blink plus separately transformed polygonal Pixi interaction zones, bounded additive reactions, eight facial states, single-pointer handling, history/cooldown/combo, responsive solo/compare modes and opt-in hitbox diagnostics. Six AI-generated candidate studies are retained in V3 only; small aligned mouth/sleepy-eye derivatives and a color blush layer are local to V3. The underlying illustration is flat; no independent arm/hair/leg rig exists. The V1 eye/blink code remains active.

`npm ci`, 13/13 unit tests, build, npm audit, desktop Chromium, iPhone-sized Chromium touch and landscape Chromium passed locally. Desktop idle/blink WebGL output matched V1 pixels exactly outside the changed UI label; mobile matched within 1/255. See `QA.md` for exact sampling and limitations.

## Still incomplete

- First iPhone-sized WebKit CI run `41985596576` matched 10 V1/V3 screenshots and initialized the V3 scene, but failed while waiting for a tap reaction after its V1 comparison tab was opened. Runs `41986101688` and `41986273501` failed a screenshot comparison around intermediate blink when switching tabs; this may be a stale WebKit compositor frame rather than a rig difference. Runs `41986603189` and `41986835226` found small but non-zero differences in synchronous WebGL buffers in sampled blink frames; do not claim exact WebKit blink parity. The test now reports that intermediate difference separately and continues to investigate touch; touch remains unverified in WebKit. Landscape WebKit has not yet run; real iPhone Safari has not been tested.
- Separate Vercel project `hero01-interactive-v3-prototype` (`prj_6ohITCsTvMMgxMtf8jYPPXzTb5q7`) deployed commit `f0ed50e1afddc43554c253e40f27c0f6e566e647` as production `dpl_8CxpiLqDiTJtUHL5GpeCF7HZXb6t` (READY), alias https://hero01-interactive-v3-prototype.vercel.app/; public browser execution still needs verification. Preview protection is separate.
- Final V1, V2 and Approved source-preservation checks and remote-file checks remain.

## Next steps

1. Commit/push this isolated implementation. Use a temporary GitHub Actions workflow to run V3 production build and iPhone/landscape Playwright WebKit if local WebKit is unavailable; remove only the temporary workflow afterward. Do not use stopped sandbox or Codespaces approaches.
2. Deploy the **separate** V3 Vercel project. Publish a public production alias if preview protection prevents anonymous use; label actual protected previews accurately. Verify built V3 locally and publicly.
3. Compare V1/V2/Approved tree entries to the baseline; check V1 and V2 public deployments remain unchanged, approved source SHA `91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd`, V3 GitHub hashes, README and QA results. Report physical-device and flat-mesh limitations honestly.

## V1 deployment safety

V1 production: https://hero01-idle-prototype.vercel.app/, project `hero01-idle-prototype`, production branch `main`, deployment `dpl_DJ6ou9Bqx6VfW1uhf7PLYfmyVvDm` from `f3ef0305b55f1b802051915732845ade2ac73cc7`. V2 public production: https://hero01-idle-v2-prototype.vercel.app/; its actual earlier Preview is protected. Never change their project settings or overwrite either deployment.
