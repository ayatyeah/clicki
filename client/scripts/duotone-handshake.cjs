/* Recolor the handshake photo into a brand duotone (deep violet → light),
   crop the watermark, export a clean on-brand image for the business page. */
const path = require('path');
const Jimp = require('jimp');

const SRC = path.join(__dirname, '..', '..', 'sdelka-chto-takoe.jpg');
const OUT = path.join(__dirname, '..', 'public', 'handshake.png');

const SHADOW = [32, 20, 74]; // deep indigo-violet
const HIGH = [240, 237, 252]; // light lavender

(async () => {
  const img = await Jimp.read(SRC);
  // Drop the watermark strip at the bottom.
  img.crop(0, 0, img.bitmap.width, Math.round(img.bitmap.height * 0.93));

  const { width: W, height: H, data } = img.bitmap;
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    // gentle S-curve for contrast
    const t = lum * lum * (3 - 2 * lum);
    data[i] = Math.round(SHADOW[0] + (HIGH[0] - SHADOW[0]) * t);
    data[i + 1] = Math.round(SHADOW[1] + (HIGH[1] - SHADOW[1]) * t);
    data[i + 2] = Math.round(SHADOW[2] + (HIGH[2] - SHADOW[2]) * t);
    data[i + 3] = 255;
  }

  await img.writeAsync(OUT);
  console.log('wrote', OUT, `(${W}x${H})`);
})();
