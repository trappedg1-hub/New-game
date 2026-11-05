# HERO-01 V3 — progress and recovery

## Current source

V3 is isolated at `ArtStudio/Prototypes/hero01-interactive-v3/` on `arena/680e6caa-new-game`, based on V1 rather than V2. The current source replaces the rejected shared-mesh-only limb motion with four independent, bounded, three-joint 2D FK/skinning chains on separate limb textures. A split shoe layer shares its leg chain to reproduce the crossed-pose layering. V1 idle/blink equations, V3 expressions, 13 zones and the original PixiJS 7.4.3 remain. See `README.md`, `QA.md` and `artifacts/PROVENANCE.md` for operation, results and substantial flat-art limitations.

Local unit, asset, Chromium desktop/portrait/landscape, production build and audit checks passed. The new version's Linux Playwright WebKit check and public deployment are **pending**. No physical iPhone Safari has been tested; software-emulated Chromium is notably slower than real-time on this host.

## Public deployment — previous version, not current source

- Public V3 production: https://hero01-interactive-v3-prototype.vercel.app/
- Project `hero01-interactive-v3-prototype` (`prj_6ohITCsTvMMgxMtf8jYPPXzTb5q7`); production `dpl_2tyuajaqVfStYAtowY7T4QfSu51J` from `9a1ccfaa80b8325ebba76f3ca2596330081b300f` is the **previous shared-mesh version**. It does not contain the independent jointed limbs currently under verification.
- Actions [`41992360329`](https://github.com/trappedg1-hub/New-game/actions/runs/41992360329) and [`41992771952`](https://github.com/trappedg1-hub/New-game/actions/runs/41992771952) tested that previous version, not the current jointed code.

## V1/V2 deployment safety

V1 production: https://hero01-idle-prototype.vercel.app/, deployment `dpl_DJ6ou9Bqx6VfW1uhf7PLYfmyVvDm`. V2 production: https://hero01-idle-v2-prototype.vercel.app/, deployment `dpl_8DRApt5WKiiMsqzPtCxTDgokCdZE`. V1/V2 source and all Approved images must remain untouched. Approved full-body SHA-256 is `91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd`.

All three Vercel projects share a Git repository; pushes can automatically create protected **preview** builds for V1/V2 from unchanged source. Do not change their project settings or production deployments.
