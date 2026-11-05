# HERO-01 V3 — progress and recovery

## Current source and verification

V3 is isolated at `ArtStudio/Prototypes/hero01-interactive-v3/` on `arena/680e6caa-new-game`, based on V1 rather than V2. The current source replaces the rejected shared-mesh-only limb motion with four independent, bounded, three-joint 2D FK/skinning chains on separate limb textures. A split shoe layer shares its leg chain to reproduce the crossed-pose layering. V1 idle/blink equations, V3 expressions, 13 zones and the original PixiJS 7.4.3 remain. See `README.md`, `QA.md` and `artifacts/PROVENANCE.md` for operation, results and substantial flat-art limitations.

Unit/asset tests, Chromium desktop/portrait/landscape, build and audit passed. The deployed runtime passed Linux Playwright WebKit portrait/landscape in [Actions 42002670816](https://github.com/trappedg1-hub/New-game/actions/runs/42002670816). [Actions 42003241834](https://github.com/trappedg1-hub/New-game/actions/runs/42003241834) repeated those checks, verified the public bundle and all jointed textures against the local build, and tested the public production URL in iPhone-sized WebKit. No physical iPhone Safari has been tested; software-emulated Chromium is notably slower than real-time on this host.

## Public deployment

- V3 production: https://hero01-interactive-v3-prototype.vercel.app/
- Separate project `hero01-interactive-v3-prototype` (`prj_6ohITCsTvMMgxMtf8jYPPXzTb5q7`). Vercel reports production `dpl_25hW1sGahNHWQgJbhYAGYszyS7vn` **READY/PROMOTED** with the public alias, built from runtime commit `22f50059fbfd63562c3034b689438819679df5f4`. The public alias, bundle and runtime assets passed the independent Actions check linked above.
- The previous deployment `dpl_2tyuajaqVfStYAtowY7T4QfSu51J` from `9a1ccfaa80b8325ebba76f3ca2596330081b300f` contained the rejected shared-mesh version. Actions [`41992360329`](https://github.com/trappedg1-hub/New-game/actions/runs/41992360329) and [`41992771952`](https://github.com/trappedg1-hub/New-game/actions/runs/41992771952) tested only that previous version.

## V1/V2 deployment safety

V1 production: https://hero01-idle-prototype.vercel.app/, deployment `dpl_DJ6ou9Bqx6VfW1uhf7PLYfmyVvDm`. V2 production: https://hero01-idle-v2-prototype.vercel.app/, deployment `dpl_8DRApt5WKiiMsqzPtCxTDgokCdZE`. V1/V2 source and all Approved images remain untouched. Approved full-body SHA-256 is `91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd`.

All three Vercel projects share a Git repository; pushes can automatically create protected **preview** builds for V1/V2 from unchanged source. Their project settings and production deployments have not been changed.
