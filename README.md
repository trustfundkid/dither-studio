# dither-studio

A zero-dependency, offline-first browser studio for converting images into crisp halftones using classic error-diffusion and ordered dithering algorithms.

## Features

- **6 Dithering Algorithms:** Atkinson (1984 Macintosh), Floyd-Steinberg, Stucki, Bayer 4x4, Bayer 8x8, and 1-bit Threshold.
- **Serpentine Scanning:** Toggle alternating scan direction to eliminate diagonal error-diffusion artifacts.
- **Curated Ink Palettes + Custom Duotone:** Switch between Newsprint, Macintosh 1984, Game Boy DMG (4-tone), Risograph Red, Cyanotype, Amber CRT, or pick any two custom colors.
- **Tactile Controls:** Real-time pixel scale (1x to 6x), contrast, brightness, threshold bias, and hold-Spacebar original comparison.
- **Instant Input & Export:** Drag and drop, click to upload, or paste directly from your clipboard. Export crisp nearest-neighbor PNGs or copy straight to clipboard.
- **Live Halftone Proof Strip:** Real-time header canvas that runs through the active algorithm and ink palette, reacts to cursor movement, and cycles between 3 wave patterns on click.
- **100% Client-Side:** Everything runs locally in your browser via the HTML5 Canvas 2D API.

## Algorithms Included

| Algorithm | Type | Character |
| :--- | :--- | :--- |
| **Atkinson** | Error diffusion (6/8) | High contrast, airy highlights, classic early Macintosh look |
| **Floyd-Steinberg** | Error diffusion (16/16) | Smooth photographic tonal transitions |
| **Stucki** | Error diffusion (42/42) | Sharp edge preservation with fine grain |
| **Bayer 4x4** | Ordered matrix | Crisp crosshatch and retro print texture |
| **Bayer 8x8** | Ordered matrix | Finer tonal steps with structured halftone feel |
| **Threshold** | Direct cut | Pure 1-bit lithograph silhouette |

## Run Locally

No build tools or package managers required. Open `index.html` directly in any modern browser.

## Project Structure

- `index.html` — Semantic layout and control deck
- `styles.css` — Printmaking darkroom styling
- `dither.js` — Pure pixel-buffer dithering engine (zero DOM dependencies)
- `app.js` — Canvas pipeline, live halftone strip, built-in samples, clipboard, and PNG export
- `LICENSE` — MIT License

## License

MIT
