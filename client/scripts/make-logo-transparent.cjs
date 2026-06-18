/* One-off: strip the white background from the brand JPGs → transparent PNGs. */
const path = require('path');
const Jimp = require('jimp');

const PUB = path.join(__dirname, '..', 'public');
const JOBS = [
  ['logo-mark.jpg', 'logo-mark.png'],
  ['logo-full.jpg', 'logo-full.png'],
];

(async () => {
  for (const [src, out] of JOBS) {
    const img = await Jimp.read(path.join(PUB, src));
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      const min = Math.min(r, g, b);
      if (r > 236 && g > 236 && b > 236) {
        this.bitmap.data[idx + 3] = 0; // pure white → fully transparent
      } else if (min > 200) {
        // feather near-white edges so the violet mark keeps a clean anti-aliased edge
        this.bitmap.data[idx + 3] = Math.max(0, Math.min(255, Math.round(((236 - min) / 36) * 255)));
      }
    });
    await img.writeAsync(path.join(PUB, out));
    console.log('wrote', out);
  }
})();
