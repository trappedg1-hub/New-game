# Animation/mobile update

- Five tier arts and seven collectible costume PNGs (eight entries including the base outfit) use safe whole-art breathing. SSR adds glow. Band-slicing prototype is in tools/slice_layers.py; moving the generated rectangular crops is intentionally not enabled because it would expose seams. Anatomical hair/chest/eye isolation requires hand masks and painted hidden pixels.
- WebP character/background payload totals approximately 1.3 MiB. PNG originals remain as fallback; pngquant was not run. This is not a claim that all stored repository assets total under 10 MB.
- Manifest, icons, install prompt, and versioned offline service worker added. Offline caching requires a successful initial online visit.
- Touch input is rate limited to 20 accepted taps/second. Vibration is best effort: iOS Safari does not implement navigator.vibrate.
- Syntax and jsdom smoke tests pass at simulated viewport widths 360/390/414/1280. These are DOM tests, not browser layout or real-device performance tests. Browser binary installation failed in this network-restricted environment; 60fps, touch latency, native installation, safe-area rendering and horizontal overflow remain unverified on devices.
- Audio sliders persist preferences only; no audio assets are included.
