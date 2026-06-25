import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVideos, saveVideos } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'content.json');

const DEFAULTS = {
  showcase: [], // now mostly fetched from DB, but keeping structure for compatibility
  devices: { iphone: { image: '' }, laptop: { image: '' } },
  creatorVideo: '', // one widescreen video shown on the creators funnel
};

const clip = (v, n = 300) => String(v || '').slice(0, n);

/** Read site content (showcase feed + device screen images). */
export async function readContent() {
  let parsed = DEFAULTS;
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Fetch showcase videos from PostgreSQL
  let showcase = [];
  try {
    showcase = await getVideos();
  } catch (err) {
    console.error('Failed to fetch videos from DB:', err);
    showcase = Array.isArray(parsed.showcase) ? parsed.showcase : []; // fallback
  }

  return {
    showcase,
    devices: {
      iphone: { image: clip(parsed?.devices?.iphone?.image) },
      laptop: { image: clip(parsed?.devices?.laptop?.image) },
    },
    creatorVideo: clip(parsed?.creatorVideo),
  };
}

/** Validate + persist site content. */
export async function writeContent(obj) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  
  const showcaseData = Array.isArray(obj?.showcase)
    ? obj.showcase
        .slice(0, 60)
        .map((it) => ({
          type: it?.type === 'image' ? 'image' : 'video',
          src: clip(it?.src),
          ...(it?.poster ? { poster: clip(it.poster) } : {}),
        }))
        .filter((it) => it.src)
    : [];

  // Save showcase videos to PostgreSQL
  try {
    await saveVideos(showcaseData);
  } catch (err) {
    console.error('Failed to save videos to DB:', err);
  }

  const safe = {
    showcase: showcaseData,
    devices: {
      iphone: { image: clip(obj?.devices?.iphone?.image) },
      laptop: { image: clip(obj?.devices?.laptop?.image) },
    },
    creatorVideo: clip(obj?.creatorVideo),
  };
  await fs.writeFile(FILE, JSON.stringify(safe, null, 2), 'utf8');
  return safe;
}
