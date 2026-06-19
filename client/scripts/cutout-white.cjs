/* Decode the AVIF handshake (white studio bg) and cut out the background.
   Flood-fill near-white from the borders so interior white cuffs stay opaque;
   keep the largest component; feather; crop; export transparent PNG. */
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '..', '..', 'handshake.avif');
const OUT = path.join(__dirname, '..', 'public', 'handshake.png');

(async () => {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const N = W * H;
  const near = (p) => {
    const i = p * 4;
    return Math.min(data[i], data[i + 1], data[i + 2]) > 226;
  };

  const bg = new Uint8Array(N);
  const st = [];
  const seed = (x, y) => {
    const p = y * W + x;
    if (!bg[p] && near(p)) {
      bg[p] = 1;
      st.push(p);
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
  while (st.length) {
    const p = st.pop();
    const x = p % W;
    const y = (p / W) | 0;
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const np = ny * W + nx;
      if (!bg[np] && near(np)) {
        bg[np] = 1;
        st.push(np);
      }
    }
  }

  // largest opaque connected component
  const comp = new Int32Array(N).fill(-1);
  let bestId = -1;
  let bestSize = 0;
  let id = 0;
  for (let p = 0; p < N; p++) {
    if (bg[p] || comp[p] !== -1) continue;
    const q = [p];
    comp[p] = id;
    let s = 0;
    while (q.length) {
      const c = q.pop();
      s++;
      const x = c % W;
      const nb = [c + 1, c - 1, c + W, c - W];
      if (x === 0) nb[1] = -1;
      if (x === W - 1) nb[0] = -1;
      for (const nc of nb) {
        if (nc < 0 || nc >= N) continue;
        if (!bg[nc] && comp[nc] === -1) {
          comp[nc] = id;
          q.push(nc);
        }
      }
    }
    if (s > bestSize) {
      bestSize = s;
      bestId = id;
    }
    id++;
  }

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
  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad);
  maxY = Math.min(H - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .png()
    .toFile(OUT);
  console.log('wrote', OUT, `${cw}x${ch} (kept ${bestSize}px of ${N})`);
})();
