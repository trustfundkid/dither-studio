/**
 * app.js — UI controller, procedural test plates, drag/drop/paste, and PNG export.
 */

(function () {
  "use strict";

  const { PALETTES, hexToRgb, ditherImageData } = window.DitherEngine;

  const ALGO_LABELS = {
    atkinson: "Atkinson",
    floyd: "Floyd-Steinberg",
    stucki: "Stucki",
    bayer4: "Bayer 4×4",
    bayer8: "Bayer 8×8",
    threshold: "Threshold",
  };

  const MAX_EDGE = 1280;

  const DEFAULT_SETTINGS = {
    algorithm: "atkinson",
    paletteKey: "newsprint",
    scale: 2,
    contrast: 10,
    brightness: 0,
    bias: 0,
    serpentine: true,
    invert: false,
  };

  const state = {
    algorithm: "atkinson",
    paletteKey: "newsprint",
    inkHex: "#1a1a1a",
    paperHex: "#f0ebe1",
    scale: 2,
    contrast: 10,
    brightness: 0,
    bias: 0,
    serpentine: true,
    invert: false,
    showingOriginal: false,
    sourceCanvas: null,
  };

  // DOM references
  const outputCanvas = document.getElementById("outputCanvas");
  const outCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
  const workCanvas = document.createElement("canvas");
  const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });

  const sampleSelect = document.getElementById("sampleSelect");
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const compareBtn = document.getElementById("compareBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const copyBtn = document.getElementById("copyBtn");
  const resetBtn = document.getElementById("resetBtn");

  const scaleSlider = document.getElementById("scaleSlider");
  const contrastSlider = document.getElementById("contrastSlider");
  const brightnessSlider = document.getElementById("brightnessSlider");
  const biasSlider = document.getElementById("biasSlider");

  const scaleVal = document.getElementById("scaleVal");
  const contrastVal = document.getElementById("contrastVal");
  const brightnessVal = document.getElementById("brightnessVal");
  const biasVal = document.getElementById("biasVal");

  const serpentineToggle = document.getElementById("serpentineToggle");
  const invertToggle = document.getElementById("invertToggle");
  const inkColor = document.getElementById("inkColor");
  const paperColor = document.getElementById("paperColor");
  const customPalBtn = document.getElementById("customPalBtn");

  const metaDims = document.getElementById("metaDims");
  const metaAlgo = document.getElementById("metaAlgo");
  const metaScale = document.getElementById("metaScale");
  const metaTime = document.getElementById("metaTime");

  let rafPending = false;

  /**
   * Procedural test plates so the studio demonstrates dithering immediately on load.
   */
  function generateTestPlate(kind) {
    const w = 800;
    const h = 560;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");

    if (kind === "sphere") {
      // Studio backdrop gradient
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#e9e9e9");
      bg.addColorStop(0.65, "#9c9c9c");
      bg.addColorStop(1, "#303030");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Architectural floor plane
      const floor = ctx.createLinearGradient(0, 390, 0, h);
      floor.addColorStop(0, "#686868");
      floor.addColorStop(1, "#1e1e1e");
      ctx.fillStyle = floor;
      ctx.fillRect(0, 390, w, h - 390);

      // Soft cast shadow
      ctx.save();
      ctx.translate(445, 428);
      ctx.scale(1.65, 0.36);
      const shadow = ctx.createRadialGradient(0, 0, 10, 0, 0, 145);
      shadow.addColorStop(0, "rgba(0,0,0,0.78)");
      shadow.addColorStop(0.7, "rgba(0,0,0,0.28)");
      shadow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(0, 0, 145, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Main sculptural sphere
      const cx = 370;
      const cy = 265;
      const r = 162;
      const sphere = ctx.createRadialGradient(cx - 56, cy - 58, 12, cx, cy, r);
      sphere.addColorStop(0, "#ffffff");
      sphere.addColorStop(0.28, "#d8d8d8");
      sphere.addColorStop(0.62, "#6e6e6e");
      sphere.addColorStop(0.88, "#1e1e1e");
      sphere.addColorStop(1, "#3d3d3d");
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Companion chrome-like small orb
      const ox = 575;
      const oy = 352;
      const or = 54;
      const orb = ctx.createRadialGradient(ox - 18, oy - 20, 4, ox, oy, or);
      orb.addColorStop(0, "#ffffff");
      orb.addColorStop(0.45, "#9a9a9a");
      orb.addColorStop(0.85, "#191919");
      orb.addColorStop(1, "#4e4e4e");
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(ox, oy, or, 0, Math.PI * 2);
      ctx.fill();

      // Specimen caption
      ctx.fillStyle = "#161616";
      ctx.font = '600 13px ui-monospace, Menlo, monospace';
      ctx.fillText("PLATE 01 / LAMBERTIAN SPHERE STUDY", 34, 46);
    } else if (kind === "horizon") {
      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, 340);
      sky.addColorStop(0, "#1d1d1d");
      sky.addColorStop(0.55, "#848484");
      sky.addColorStop(1, "#efefef");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, 340);

      // Sun disc
      const sun = ctx.createRadialGradient(400, 265, 10, 400, 265, 92);
      sun.addColorStop(0, "#ffffff");
      sun.addColorStop(0.82, "#f6f6f6");
      sun.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(400, 265, 92, 0, Math.PI * 2);
      ctx.fill();

      // Layered mountain silhouettes
      const drawRidge = (yBase, amp, freq, phase, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) {
          const y =
            yBase -
            Math.sin(x * freq + phase) * amp -
            Math.cos(x * freq * 2.3 + phase) * (amp * 0.42);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      };

      drawRidge(330, 42, 0.009, 0.4, "#9a9a9a");
      drawRidge(370, 50, 0.011, 2.2, "#595959");
      drawRidge(425, 36, 0.014, 4.1, "#242424");

      // Water reflection shimmer
      const sea = ctx.createLinearGradient(0, 430, 0, h);
      sea.addColorStop(0, "#404040");
      sea.addColorStop(1, "#121212");
      ctx.fillStyle = sea;
      ctx.fillRect(0, 430, w, h - 430);

      for (let i = 0; i < 18; i++) {
        const ry = 438 + i * 7;
        const rw = 140 - i * 5;
        ctx.fillStyle = `rgba(255,255,255,${0.55 - i * 0.028})`;
        ctx.fillRect(400 - rw / 2, ry, rw, 2.5);
      }
    } else {
      // Optical calibration wedge + radial burst
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, 0, w, h);

      // Continuous tonal ramp
      const ramp = ctx.createLinearGradient(40, 0, w - 40, 0);
      ramp.addColorStop(0, "#000000");
      ramp.addColorStop(1, "#ffffff");
      ctx.fillStyle = ramp;
      ctx.fillRect(40, 54, w - 80, 110);

      // 12-step discrete luminance chart
      const steps = 12;
      const sw = (w - 80) / steps;
      for (let i = 0; i < steps; i++) {
        const v = Math.round((i / (steps - 1)) * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(40 + i * sw, 184, sw + 0.5, 84);
      }

      // Soft radial vignette + concentric rings
      const rad = ctx.createRadialGradient(230, 410, 8, 230, 410, 125);
      rad.addColorStop(0, "#ffffff");
      rad.addColorStop(0.5, "#777777");
      rad.addColorStop(1, "#000000");
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(230, 410, 125, 0, Math.PI * 2);
      ctx.fill();

      // Fine frequency lines
      for (let i = 0; i < 36; i++) {
        const y = 296 + i * 6.5;
        const shade = Math.round((i / 35) * 200);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(420, y, 340, 3);
      }
    }

    return c;
  }

  function loadImageElement(img) {
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (w > MAX_EDGE || h > MAX_EDGE) {
      const ratio = Math.min(MAX_EDGE / w, MAX_EDGE / h);
      w = Math.max(1, Math.round(w * ratio));
      h = Math.max(1, Math.round(h * ratio));
    }

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    state.sourceCanvas = c;
    const customOpt = sampleSelect.querySelector('option[value="custom"]');
    if (customOpt) customOpt.hidden = false;
    sampleSelect.value = "custom";
    scheduleRender();
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => loadImageElement(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function getActivePalette() {
    if (state.paletteKey === "custom") {
      return [hexToRgb(state.inkHex), hexToRgb(state.paperHex)];
    }
    return (PALETTES[state.paletteKey] || PALETTES.newsprint).colors;
  }

  function render() {
    rafPending = false;
    const src = state.sourceCanvas;
    if (!src) return;

    const t0 = performance.now();
    const outW = src.width;
    const outH = src.height;

    if (outputCanvas.width !== outW || outputCanvas.height !== outH) {
      outputCanvas.width = outW;
      outputCanvas.height = outH;
    }

    if (state.showingOriginal) {
      outCtx.imageSmoothingEnabled = true;
      outCtx.drawImage(src, 0, 0, outW, outH);
      metaAlgo.textContent = "Original";
      metaTime.textContent = "bypass";
      return;
    }

    const scale = state.scale;
    const workW = Math.max(1, Math.round(outW / scale));
    const workH = Math.max(1, Math.round(outH / scale));

    workCanvas.width = workW;
    workCanvas.height = workH;
    workCtx.imageSmoothingEnabled = true;
    workCtx.drawImage(src, 0, 0, workW, workH);

    const imgData = workCtx.getImageData(0, 0, workW, workH);
    ditherImageData(imgData, {
      algorithm: state.algorithm,
      palette: getActivePalette(),
      contrast: state.contrast,
      brightness: state.brightness,
      bias: state.bias,
      serpentine: state.serpentine,
      invert: state.invert,
    });
    workCtx.putImageData(imgData, 0, 0);

    outCtx.imageSmoothingEnabled = false;
    outCtx.clearRect(0, 0, outW, outH);
    outCtx.drawImage(workCanvas, 0, 0, workW, workH, 0, 0, outW, outH);

    const elapsed = (performance.now() - t0).toFixed(1);
    metaDims.textContent = `${outW} × ${outH} px`;
    metaAlgo.textContent = ALGO_LABELS[state.algorithm] || state.algorithm;
    metaScale.textContent = `${scale}× pixel`;
    metaTime.textContent = `${elapsed} ms`;
  }

  function scheduleRender() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(render);
    }
  }

  // Event wiring: sample image dropdown
  sampleSelect.addEventListener("change", () => {
    const val = sampleSelect.value;
    if (val === "custom") return;
    state.sourceCanvas = generateTestPlate(val);
    scheduleRender();
  });

  // Event wiring: algorithm buttons
  document.getElementById("algoGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-algo]");
    if (!btn) return;
    state.algorithm = btn.dataset.algo;
    document.querySelectorAll("#algoGrid .seg").forEach((b) => b.classList.toggle("active", b === btn));
    scheduleRender();
  });

  // Event wiring: palette buttons
  function selectPalette(key) {
    state.paletteKey = key;
    document.querySelectorAll(".pal").forEach((b) => {
      b.classList.toggle("active", b.dataset.palette === key);
    });
    scheduleRender();
  }

  document.getElementById("paletteGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-palette]");
    if (btn) selectPalette(btn.dataset.palette);
  });

  customPalBtn.addEventListener("click", () => selectPalette("custom"));

  inkColor.addEventListener("input", () => {
    state.inkHex = inkColor.value;
    selectPalette("custom");
  });

  paperColor.addEventListener("input", () => {
    state.paperHex = paperColor.value;
    selectPalette("custom");
  });

  // Sliders & toggles
  scaleSlider.addEventListener("input", () => {
    state.scale = Number(scaleSlider.value);
    scaleVal.textContent = `${state.scale}×`;
    scheduleRender();
  });

  contrastSlider.addEventListener("input", () => {
    state.contrast = Number(contrastSlider.value);
    contrastVal.textContent = String(state.contrast);
    scheduleRender();
  });

  brightnessSlider.addEventListener("input", () => {
    state.brightness = Number(brightnessSlider.value);
    brightnessVal.textContent = String(state.brightness);
    scheduleRender();
  });

  biasSlider.addEventListener("input", () => {
    state.bias = Number(biasSlider.value);
    biasVal.textContent = String(state.bias);
    scheduleRender();
  });

  serpentineToggle.addEventListener("change", () => {
    state.serpentine = serpentineToggle.checked;
    scheduleRender();
  });

  invertToggle.addEventListener("change", () => {
    state.invert = invertToggle.checked;
    scheduleRender();
  });

  // File upload, drag & drop, clipboard paste
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      loadFile(fileInput.files[0]);
      fileInput.value = "";
    }
  });

  ["dragenter", "dragover"].forEach((ev) => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-active");
    });
  });

  ["dragleave", "drop"].forEach((ev) => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-active");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadFile(file);
  });

  window.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        loadFile(items[i].getAsFile());
        break;
      }
    }
  });

  // Hold to compare original (button + Spacebar)
  function setCompare(active) {
    if (state.showingOriginal === active) return;
    state.showingOriginal = active;
    scheduleRender();
  }

  compareBtn.addEventListener("mousedown", () => setCompare(true));
  compareBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    setCompare(true);
  });
  ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((ev) => {
    compareBtn.addEventListener(ev, () => setCompare(false));
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && document.activeElement.tagName !== "INPUT") {
      e.preventDefault();
      setCompare(true);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") setCompare(false);
  });

  // Export & Reset
  downloadBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `dither-studio-${state.algorithm}-${state.scale}x.png`;
    link.href = outputCanvas.toDataURL("image/png");
    link.click();
  });

  copyBtn.addEventListener("click", async () => {
    const originalText = copyBtn.textContent;
    try {
      const blob = await new Promise((resolve) => outputCanvas.toBlob(resolve, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copyBtn.textContent = "Copied!";
    } catch {
      copyBtn.textContent = "Use Download";
    }
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 1400);
  });

  resetBtn.addEventListener("click", () => {
    Object.assign(state, DEFAULT_SETTINGS);
    scaleSlider.value = String(state.scale);
    contrastSlider.value = String(state.contrast);
    brightnessSlider.value = String(state.brightness);
    biasSlider.value = String(state.bias);
    scaleVal.textContent = `${state.scale}×`;
    contrastVal.textContent = String(state.contrast);
    brightnessVal.textContent = String(state.brightness);
    biasVal.textContent = String(state.bias);
    serpentineToggle.checked = state.serpentine;
    invertToggle.checked = state.invert;
    document.querySelectorAll("#algoGrid .seg").forEach((b) => {
      b.classList.toggle("active", b.dataset.algo === state.algorithm);
    });
    selectPalette(state.paletteKey);
  });

  // Live halftone proof strip in the top bar (reacts to active algorithm, palette, and cursor)
  const liveStrip = document.getElementById("liveStrip");
  const liveRibbon = document.getElementById("liveRibbon");
  const ribbonCtx = liveRibbon ? liveRibbon.getContext("2d") : null;
  let ribbonMode = 0;
  let ribbonHoverX = -1;
  let ribbonLastFrame = 0;

  if (liveStrip && liveRibbon && ribbonCtx) {
    const rw = liveRibbon.width;
    const rh = liveRibbon.height;
    const ribbonBuffer = ribbonCtx.createImageData(rw, rh);

    liveStrip.addEventListener("mousemove", (e) => {
      const rect = liveRibbon.getBoundingClientRect();
      ribbonHoverX = ((e.clientX - rect.left) / rect.width) * rw;
    });

    liveStrip.addEventListener("mouseleave", () => {
      ribbonHoverX = -1;
    });

    liveStrip.addEventListener("click", () => {
      ribbonMode = (ribbonMode + 1) % 3;
    });

    function tickRibbon(now) {
      requestAnimationFrame(tickRibbon);
      if (document.hidden || now - ribbonLastFrame < 33) return;
      ribbonLastFrame = now;

      const t = now * 0.0014;
      const data = ribbonBuffer.data;

      for (let y = 0; y < rh; y++) {
        const ny = (y / (rh - 1)) * 2 - 1;
        for (let x = 0; x < rw; x++) {
          const nx = x / (rw - 1);
          let v;

          if (ribbonMode === 0) {
            const w1 = Math.sin(nx * 9.5 - t * 1.6 + ny * 1.4);
            const w2 = Math.cos(nx * 5.2 + t * 1.1 - ny * 2.1);
            v = 128 + (w1 * 0.55 + w2 * 0.45) * 112;
          } else if (ribbonMode === 1) {
            const cx = 0.5 + Math.sin(t * 0.95) * 0.38;
            const dx = (nx - cx) * 3.8;
            const dy = ny * 0.9;
            const dist = Math.sqrt(dx * dx + dy * dy);
            v = 245 - dist * 190 + Math.sin(nx * 14 - t * 2.2) * 18;
          } else {
            const cx = ribbonHoverX >= 0 ? ribbonHoverX / rw : 0.5;
            const dx = (nx - cx) * 4.5;
            const dy = ny * 1.0;
            const dist = Math.sqrt(dx * dx + dy * dy);
            v = 128 + Math.cos(dist * 6.5 - t * 3.0) * 112;
          }

          if (ribbonHoverX >= 0) {
            const pxDist = Math.abs(x - ribbonHoverX);
            if (pxDist < 16) {
              v += (1 - pxDist / 16) * 78;
            }
          }

          const clamped = v < 0 ? 0 : v > 255 ? 255 : v;
          const p = (y * rw + x) * 4;
          data[p] = clamped;
          data[p + 1] = clamped;
          data[p + 2] = clamped;
          data[p + 3] = 255;
        }
      }

      ditherImageData(ribbonBuffer, {
        algorithm: state.algorithm,
        palette: getActivePalette(),
        contrast: 8,
        brightness: 0,
        bias: 0,
        serpentine: state.serpentine,
        invert: state.invert,
      });

      ribbonCtx.putImageData(ribbonBuffer, 0, 0);
    }

    requestAnimationFrame(tickRibbon);
  }

  // Initialize with sculptural sphere study
  state.sourceCanvas = generateTestPlate("sphere");
  render();
})();
