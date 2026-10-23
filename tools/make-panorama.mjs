// Turns a NASA cylindrical panorama into the standard 360 x 180 degree picture the game wraps around the player.
//
//   node tools/make-panorama.mjs <source.jpg> <output-folder> <output-name>
//
// Example (Mars, Perseverance's first 360-degree panorama, PIA24264):
//   node tools/make-panorama.mjs PIA24264.jpg public/textures/surfaces mars-jezero
//
// What it does, and nothing else:
//   1. Re-projects the photo (cylindrical, so it only covers part of the sky-to-ground range) onto a full sphere picture.
//   2. Where the photo stops, continues the real sky colours upward (fading to a darker sky overhead) and the real
//      ground colours downward (fading to dark). No new detail is drawn.
//   3. Writes <name>-4096.jpg (4096 x 2048) and <name>-2048.jpg (2048 x 1024, used in low-quality mode).
//
// The numbers below describe the PIA24264 photo. Change them for a different panorama.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [source, outDir, name] = process.argv.slice(2);
if (!source || !outDir || !name) {
  console.error('Usage: node tools/make-panorama.mjs <source.jpg> <output-folder> <output-name>');
  process.exit(1);
}

// Where the horizon is in the photo, as a fraction of its height from the top (the far hills meet the sky there).
const HORIZON = 0.088;
// The photo has a thin black border at the top and bottom edge (measured: dark until row 28, dark again from row 2418; a few extra rows are cut so smoothing never touches them
// of 2451). Those rows are cut off so they never reach the game.
const CROP_TOP = 38;
const CROP_BOTTOM = 45;
const JPEG_QUALITY = 0.86;

const browser = await chromium.launch();
const page = await browser.newPage();
const outputs = await page.evaluate(
  async ({ dataUrl, horizon, quality, cropTop, cropBottom }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    const src = document.createElement('canvas');
    src.width = sw;
    src.height = sh;
    const sctx = src.getContext('2d');
    sctx.drawImage(img, 0, 0);
    const sp = sctx.getImageData(0, 0, sw, sh).data;

    // Pixels per radian across the photo: one full turn spans its width.
    const focal = sw / (2 * Math.PI);
    const horizonRow = horizon * sh;
    const rowTop = cropTop; // first usable photo row
    const rowBottom = sh - cropBottom; // one past the last usable photo row
    const latTop = Math.atan((horizonRow - rowTop) / focal); // highest angle the photo reaches
    const latBottom = Math.atan((horizonRow - rowBottom) / focal); // lowest angle the photo reaches

    // Average colour of the photo's top and bottom edge rows, per column, smoothed sideways, so the sky and ground blend in.
    const edge = (rows) => {
      const out = new Float32Array(sw * 3);
      for (let x = 0; x < sw; x++) {
        let r = 0, g = 0, b = 0;
        for (const y of rows) {
          const i = (y * sw + x) * 4;
          r += sp[i]; g += sp[i + 1]; b += sp[i + 2];
        }
        out[x * 3] = r / rows.length; out[x * 3 + 1] = g / rows.length; out[x * 3 + 2] = b / rows.length;
      }
      const blurred = new Float32Array(sw * 3);
      const radius = Math.round(sw / 40);
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += out[((k + sw) % sw) * 3 + c];
        for (let x = 0; x < sw; x++) {
          blurred[x * 3 + c] = sum / (2 * radius + 1);
          sum += out[((x + radius + 1) % sw) * 3 + c] - out[((x - radius + sw) % sw) * 3 + c];
        }
      }
      return blurred;
    };
    const skyEdge = edge([rowTop + 2, rowTop + 4, rowTop + 6, rowTop + 8, rowTop + 10, rowTop + 12]);
    const groundEdge = edge([rowBottom - 14, rowBottom - 12, rowBottom - 10, rowBottom - 8, rowBottom - 6, rowBottom - 4]);

    const smooth = (t) => t * t * (3 - 2 * t);
    const bilinear = (fx, fy, c) => {
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const xa = ((x0 % sw) + sw) % sw, xb = (xa + 1) % sw;
      const ya = Math.min(sh - 1, Math.max(0, y0)), yb = Math.min(sh - 1, ya + 1);
      const p = (x, y) => sp[(y * sw + x) * 4 + c];
      return (p(xa, ya) * (1 - tx) + p(xb, ya) * tx) * (1 - ty) + (p(xa, yb) * (1 - tx) + p(xb, yb) * tx) * ty;
    };

    const render = (width, height) => {
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const octx = out.getContext('2d');
      const img2 = octx.createImageData(width, height);
      const feather = 0.03; // radians over which the photo blends into the sky / ground
      for (let y = 0; y < height; y++) {
        const lat = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
        for (let x = 0; x < width; x++) {
          const u = (x + 0.5) / width;
          const sx = u * sw;
          const col = Math.floor(sx) % sw;
          let rgb = [0, 0, 0];
          let photo = 0; // 1 = all photo
          if (lat <= latTop && lat >= latBottom) {
            photo = Math.min(1, (latTop - lat) / feather, (lat - latBottom) / feather);
          }
          if (photo > 0) {
            const fy = horizonRow - focal * Math.tan(lat);
            rgb = [bilinear(sx - 0.5, fy - 0.5, 0), bilinear(sx - 0.5, fy - 0.5, 1), bilinear(sx - 0.5, fy - 0.5, 2)];
          }
          if (photo < 1) {
            let fill;
            // Blend toward the sky near the top of the photo and toward the ground near the bottom.
            if (lat > (latTop + latBottom) / 2) {
              // Sky: the real colour at the top edge, fading to a darker, redder sky overhead.
              const t = smooth(Math.max(0, lat - latTop) / (Math.PI / 2 - latTop));
              const e = [skyEdge[col * 3], skyEdge[col * 3 + 1], skyEdge[col * 3 + 2]];
              fill = [e[0] * (1 - 0.5 * t), e[1] * (1 - 0.58 * t), e[2] * (1 - 0.6 * t)];
            } else {
              // Ground: the real colour at the bottom edge, fading to dark under the rover.
              const t = smooth(Math.max(0, latBottom - lat) / (latBottom + Math.PI / 2));
              const e = [groundEdge[col * 3], groundEdge[col * 3 + 1], groundEdge[col * 3 + 2]];
              fill = [e[0] * (1 - 0.8 * t), e[1] * (1 - 0.8 * t), e[2] * (1 - 0.8 * t)];
            }
            rgb = [rgb[0] * photo + fill[0] * (1 - photo), rgb[1] * photo + fill[1] * (1 - photo), rgb[2] * photo + fill[2] * (1 - photo)];
          }
          const i = (y * width + x) * 4;
          img2.data[i] = rgb[0]; img2.data[i + 1] = rgb[1]; img2.data[i + 2] = rgb[2]; img2.data[i + 3] = 255;
        }
      }
      octx.putImageData(img2, 0, 0);
      return out.toDataURL('image/jpeg', quality);
    };

    return {
      size: { sw, sh, latTopDeg: (latTop * 180) / Math.PI, latBottomDeg: (latBottom * 180) / Math.PI },
      big: render(4096, 2048),
      small: render(2048, 1024),
    };
  },
  {
    dataUrl: `data:image/jpeg;base64,${readFileSync(source).toString('base64')}`,
    horizon: HORIZON,
    quality: JPEG_QUALITY,
    cropTop: CROP_TOP,
    cropBottom: CROP_BOTTOM,
  },
);
await browser.close();

mkdirSync(outDir, { recursive: true });
const save = (dataUrl, file) => {
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(join(outDir, file), bytes);
  console.log(`${file}: ${(bytes.length / 1024).toFixed(0)} kB`);
};
save(outputs.big, `${name}-4096.jpg`);
save(outputs.small, `${name}-2048.jpg`);
console.log(`source ${outputs.size.sw}x${outputs.size.sh}; the photo covers ${outputs.size.latBottomDeg.toFixed(1)} to +${outputs.size.latTopDeg.toFixed(1)} degrees`);
