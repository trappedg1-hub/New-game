# Costume layer candidates — not enabled

40 generated source images across four batches. Runtime manifest remains unchanged.

- Batch 01: cardigan and track. RGB baked checkerboard; unsuitable for direct compositing.
- Batch 02: apron and maid. Green keyed to RGBA; facial/body/hair registration pending.
- Batch 03: pool and gown. Green keyed to RGBA; facial/body/hair registration pending. Blink pairs change expression beyond eyelids; must lock non-eye pixels before enabling.
- Batch 04: bunny and cardigan-v2. Green keyed to RGBA; registration pending. Bunny body still contains bunny ears also present in front-hair layer; remove duplicate accessory from body before enabling. Blink pairs change expression beyond eyelids; must lock non-eye pixels.

Next: stop broad generation, register and validate one complete rig, then apply the proven pipeline to others. Track needs a usable replacement set. No new candidate rig has been deployed.

Cardigan-v2: registered into assets/characters/costume_cardigan; enabled in local runtime manifest v10. Open/closed composites reviewed and mobile/desktop browser tests pass. Other six costumes still fallback. Not deployed in this turn.

Track: recovered alpha from neutral backgrounds using edge-connected flood fill for body/faces (white socks/shoes and eye highlights retained), registered independent layers, locked eye-only blink. Enabled in runtime manifest v11. Browser tests390/1280 and wardrobe pixel tests pass for both cardigan and track. Five costumes remain fallback. No new images generated during assembly turns; no Vercel deployment yet.

Apron: registered independent layers and removed duplicate blank skull plus generated dark bridge inside front hair opening. Open/closed composites reviewed; generated expression is not identical to original full art. Enabled runtime manifest v12, SWv19. Pixel checks pass for apron/cardigan/track; browser390/1280 verifies exclusive blink, independent hair and scene context for all three. Four costumes remain fallback. No new generation, no Vercel deployment this turn.

Maid: independent long back hair, front bangs/maid headpiece, body and registered face pair enabled in manifest v13/SWv20. Detached front-hair scraps discarded; dark cheek bridge removed. Expanded eyelid support after visual review caught remaining iris pixels. Open/closed composites reviewed. Pixel tests pass for four wardrobe rigs and all five base tiers; browser390/1280 passes. Hair animation sampling made deterministic by seeking the CSS animation, avoiding a flaky timer comparison at its turning point. Three costumes remain fallback: pool/gown/bunny. No generation or Vercel deployment this turn.

Pool: registered independent layers; open and closed head plus full-body composite reviewed. Removed duplicate blank skull and bridge inside front-hair opening. Eye-only blink locked; full iris closes. Enabled manifest v14/SWv21. Single lowest-foot contact spot, not a false contact under raised foot. Wardrobe pixel checks (5 costumes) and browser390/1280 (5 layered costumes + gown/bunny fallbacks) pass. No image generation or Vercel deployment this turn.

Gown and Bunny complete: open/closed composites reviewed, eye-only pairs locked. Bunny ears exist only on front-hair layer. All SEVEN costumes enabled, manifest v16/SWv23. All wardrobe and base-tier pixel checks plus browser390/1280 pass; gown switches to bedroom. No new generation in final assembly turn. Candidate/intermediate PNGs remain workspace-only and are excluded from Git; final runtime layers and audit JSONs ship. Previous fallback notes above are historical.
