# HERO-01 V3 — progress and recovery

## Current state

V3 is isolated at `ArtStudio/Prototypes/hero01-interactive-v3/` on the fixed session branch `arena/680e6caa-new-game`. A separate branch cannot be created in this session; a separate folder and Vercel project were used instead. The V3 baseline-copy commit `b260f1c` was made directly from approved V1, not V2.

The implementation retains V1's PixiJS 7.4.3 `51 × 149` shared mesh, idle and blink, and adds 13 transformed polygonal Pixi interaction zones, bounded reactions, eight facial states, cooldown/combo history, responsive solo/compare modes and opt-in hitbox diagnostics. The character image remains a flat mesh: it is not a layered or skeletal rig. Six AI expression studies and the derived mouth/sleepy-eye patches remain experimental and isolated to V3.

## Production deployment

- Public **production**: https://hero01-interactive-v3-prototype.vercel.app/
- Separate project `hero01-interactive-v3-prototype` (`prj_6ohITCsTvMMgxMtf8jYPPXzTb5q7`), production deployment `dpl_Dd5Qi6fHdg9sUQWisWbBRXrTe5Pq`, READY/PROMOTED from `683f09cf9e5076a7bed253dffbfb2cb956fa57ee`. Later commits only modify tests or documentation, not the deployed runtime.
- GitHub Actions [`41988835670`](https://github.com/trappedg1-hub/New-game/actions/runs/41988835670) checked the public JS bundle against the tested build and passed the public URL through iPhone-sized WebKit, including all 13 touchscreen zones. This is browser emulation, not a physical iPhone.

## Verification and limitations

- 14/14 unit tests, reproducible expression derivatives/asset checks, build and audit passed. Desktop, portrait and landscape Chromium and iPhone-sized portrait/landscape WebKit passed the interaction and controls suite.
- A WebKit run before the fix (`41987401458`) showed a real lost tap: 175 ms elapsed between events, but a frame-only reaction clock had not advanced. The reaction clock now updates on input and frames; explicit slow-frame tests cover this regression.
- WebKit idle frames with eyes open matched the strict V1 pixel tolerance. Some WebKit blink-frame comparisons produced variable local differences; the cause is not established and exact WebKit blink parity is **not** claimed. See `QA.md` for metrics and test thresholds.
- Real iPhone Safari and a WebKit swipe were not tested. The V1 blink can visibly flatten eyes mid-blink, and high-zoom expression transitions can show brief softness/ghosting. Expression studies have not been approved as final assets.
- A final tree comparison found all 79 V1/V2/Approved Git entries identical to the pre-V3 baseline; approved source SHA-256 is `91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd`. V1 and V2 production deployments were not changed.

## V1/V2 deployment safety

V1 production: https://hero01-idle-prototype.vercel.app/, deployment `dpl_DJ6ou9Bqx6VfW1uhf7PLYfmyVvDm`. V2 production: https://hero01-idle-v2-prototype.vercel.app/, deployment `dpl_8DRApt5WKiiMsqzPtCxTDgokCdZE`. Their separate projects and approved artwork are not the V3 target.
