/* One-off: remove the orange background from the handshake photo.
   Flood-fill the reddish background from the borders → transparent, keep only
   the largest opaque component (drops the watermark + stray specks), feather. */
const path = require('path');
const Jimp = require('jimp');

const SRC = path.join(__dirname, '..', '..', 'sdelka-chto-takoe.jpg');
const OUT = path.join(__dirname, '..', 'public', 'handshake.png');

// Background = saturated orange/red. Skin reads lower-saturation, suits dark,
// cuffs near-grey — so a saturation + hue gate separates them.
function isBg(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return s > 0.52 && v > 0.18 && v < 0.82 && (h < 38 || h > 350);
}

(async () => {
  const img = await Jimp.read(SRC);
  const { width: W, height: H, data } = img.bitmap;
  const N = W * H;
  const bg = new Uint8Array(N);
  const stack = [];

  const seed = (x, y) => {
    const p = y * W + x;
    const i = p * 4;
    if (!bg[p] && isBg(data[i], data[i + 1], data[i + 2])) {
      bg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < W; x++) {
    seed(x, 0);
    seed(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    seed(0, y);
    seed(W - 1, y);
  }

  // Grow through connected background (saturated-orange) pixels from the border.
  while (stack.length) {
    const p = stack.pop();
    const x = p % W;
    const y = (p / W) | 0;
    const nbs = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of nbs) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const np = ny * W + nx;
      if (bg[np]) continue;
      const ni = np * 4;
      if (isBg(data[ni], data[ni + 1], data[ni + 2])) {
        bg[np] = 1;
        stack.push(np);
      }
    }
  }

  // Keep only the largest opaque connected component (drops watermark/specks).
  const comp = new Int32Array(N).fill(-1);
  let bestId = -1;
  let bestSize = 0;
  let id = 0;
  for (let p = 0; p < N; p++) {
    if (bg[p] || comp[p] !== -1) continue;
    const q = [p];
    comp[p] = id;
    let size = 0;
    while (q.length) {
      const c = q.pop();
      size++;
      const x = c % W;
      const y = (c / W) | 0;
      const nbs = [c + 1, c - 1, c + W, c - W];
      if (x === 0) nbs[1] = -1;
      if (x === W - 1) nbs[0] = -1;
      for (const nc of nbs) {
        if (nc < 0 || nc >= N) continue;
        if (bg[nc] || comp[nc] !== -1) continue;
        comp[nc] = id;
        q.push(nc);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
    id++;
  }

  // Build alpha mask, then a light 3x3 feather.
  const alpha = new Float32Array(N);
  for (let p = 0; p < N; p++) alpha[p] = comp[p] === bestId ? 255 : 0;
  const soft = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          sum += alpha[ny * W + nx];
          cnt++;
        }
      }
      soft[y * W + x] = sum / cnt;
    }
  }
  for (let p = 0; p < N; p++) data[p * 4 + 3] = Math.round(soft[p]);

  // Crop to the opaque bounding box.
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad);
  maxY = Math.min(H - 1, maxY + pad);
  img.crop(minX, minY, maxX - minX + 1, maxY - minY + 1);

  await img.writeAsync(OUT);
  console.log('wrote', OUT, `(${maxX - minX + 1}x${maxY - minY + 1}, kept ${bestSize}px)`);
})();
