# Changelog

## 1.0.0 (2026-10-26)

- First release.
- `<latar-bg>` custom element and `Latar.mount()` for plain JavaScript.
- Five fragment shaders: mesh, aurora, contour, fog, dots. Each takes any four colors.
- Options: preset, colors, speed, scale, intensity, grain, interactive (follows the pointer), resolution, paused, seed.
- Pauses when off screen or when the tab is hidden; draws a single frame with reduced motion; caps device pixel ratio and canvas size.
- CSS gradient fallback when WebGL is missing or fails, and recovery after a lost context.
- `snapshot(width, height)` renders a PNG at any size, used by the playground to save wallpapers.
- 19 tests, including every shader rendering in real WebGL.
