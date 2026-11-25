/**
 * dither.js — Pure pixel-buffer dithering engine (zero DOM dependencies).
 *
 * Supports error-diffusion (Atkinson, Floyd-Steinberg, Stucki),
 * ordered matrices (Bayer 4x4, Bayer 8x8), and 1-bit threshold quantization.
 */

(function (global) {
  "use strict";

  const PALETTES = {
    newsprint: {
      name: "Newsprint",
      colors: [
        [20, 19, 18],
        [244, 241, 234],
      ],
    },
    macintosh: {
      name: "Macintosh 1984",
      colors: [
        [0, 0, 0],
        [255, 255, 255],
      ],
    },
    dmg: {
      name: "Game Boy DMG",
      colors: [
        [15, 56, 15],
        [48, 98, 48],
        [139, 172, 15],
        [155, 188, 15],
      ],
    },
    risograph: {
      name: "Risograph Red",
      colors: [
        [217, 56, 30],
        [250, 246, 238],
      ],
    },
    cyanotype: {
      name: "Cyanotype",
      colors: [
        [18, 43, 74],
        [242, 245, 248],
      ],
    },
    amber: {
      name: "Amber CRT",
      colors: [
        [20, 16, 8],
        [255, 176, 0],
      ],
    },
  };

  const BAYER_4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  const BAYER_8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];

  // Error-diffusion kernels: [dx, dy, weight]
  const KERNELS = {
    atkinson: {
      divisor: 8,
      weights: [
        [1, 0, 1],
        [2, 0, 1],
        [-1, 1, 1],
        [0, 1, 1],
        [1, 1, 1],
        [0, 2, 1],
      ],
    },
    floyd: {
      divisor: 16,
      weights: [
        [1, 0, 7],
        [-1, 1, 3],
        [0, 1, 5],
        [1, 1, 1],
      ],
    },
    stucki: {
      divisor: 42,
      weights: [
        [1, 0, 8],
        [2, 0, 4],
        [-2, 1, 2],
        [-1, 1, 4],
        [0, 1, 8],
        [1, 1, 4],
        [2, 1, 2],
        [-2, 2, 1],
        [-1, 2, 2],
        [0, 2, 4],
        [1, 2, 2],
        [2, 2, 1],
      ],
    },
  };

  function hexToRgb(hex) {
    const clean = hex.replace("#", "").trim();
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function clamp(val, min = 0, max = 255) {
    return val < min ? min : val > max ? max : val;
  }

  /**
   * Applies dithering to an ImageData buffer in place and returns it.
   */
  function ditherImageData(imageData, options) {
    const {
      algorithm = "atkinson",
      palette = PALETTES.newsprint.colors,
      contrast = 0,
      brightness = 0,
      bias = 0,
      serpentine = true,
      invert = false,
    } = options || {};

    const { width, height, data } = imageData;
    const count = width * height;
    const luma = new Float32Array(count);

    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0, p = 0; i < count; i++, p += 4) {
      let y = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
      y = contrastFactor * (y - 128) + 128 + brightness + bias;
      if (invert) y = 255 - y;
      luma[i] = clamp(y);
    }

    const levels = palette.length;
    const maxIdx = levels - 1;
    const step = 255 / maxIdx;

    if (algorithm === "bayer4" || algorithm === "bayer8") {
      const matrix = algorithm === "bayer4" ? BAYER_4 : BAYER_8;
      const size = matrix.length;
      const norm = size * size;
      const spread = step * 0.9;

      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        const mRow = matrix[y & (size - 1)];
        for (let x = 0; x < width; x++) {
          const idx = rowOffset + x;
          const threshold = (mRow[x & (size - 1)] / norm - 0.5) * spread;
          const val = clamp(luma[idx] + threshold);
          const palIdx = Math.min(maxIdx, Math.max(0, Math.round(val / step)));
          const color = palette[palIdx];
          const p = idx * 4;
          data[p] = color[0];
          data[p + 1] = color[1];
          data[p + 2] = color[2];
          data[p + 3] = 255;
        }
      }
      return imageData;
    }

    if (algorithm === "threshold") {
      for (let i = 0; i < count; i++) {
        const palIdx = Math.min(maxIdx, Math.max(0, Math.round(luma[i] / step)));
        const color = palette[palIdx];
        const p = i * 4;
        data[p] = color[0];
        data[p + 1] = color[1];
        data[p + 2] = color[2];
        data[p + 3] = 255;
      }
      return imageData;
    }

    const kernel = KERNELS[algorithm] || KERNELS.atkinson;
    const { divisor, weights } = kernel;

    for (let y = 0; y < height; y++) {
      const reverse = serpentine && (y & 1) === 1;
      const xStart = reverse ? width - 1 : 0;
      const xEnd = reverse ? -1 : width;
      const xStep = reverse ? -1 : 1;
      const dir = reverse ? -1 : 1;
      const rowOffset = y * width;

      for (let x = xStart; x !== xEnd; x += xStep) {
        const idx = rowOffset + x;
        const oldVal = clamp(luma[idx]);
        const palIdx = Math.min(maxIdx, Math.max(0, Math.round(oldVal / step)));
        const newVal = palIdx * step;
        const err = (oldVal - newVal) / divisor;

        const color = palette[palIdx];
        const p = idx * 4;
        data[p] = color[0];
        data[p + 1] = color[1];
        data[p + 2] = color[2];
        data[p + 3] = 255;

        for (let k = 0; k < weights.length; k++) {
          const nx = x + weights[k][0] * dir;
          const ny = y + weights[k][1];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            luma[ny * width + nx] += err * weights[k][2];
          }
        }
      }
    }

    return imageData;
  }

  const api = { PALETTES, hexToRgb, ditherImageData };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.DitherEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
