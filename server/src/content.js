import { getVideos, saveVideos, getSiteContent, saveSiteContent } from './db.js';

const clip = (v, n = 300) => String(v || '').slice(0, n);

/** Read site content: showcase from the videos table, devices + creator video
 *  from the persistent site_content row (survives redeploys). */
export async function readContent() {
  let kv = {};
  try {
    kv = await getSiteContent();
  } catch (err) {
    console.error('Failed to read site content:', err);
  }

  let showcase = [];
  try {
    showcase = await getVideos();
  } catch (err) {
    console.error('Failed to fetch videos from DB:', err);
  }

  return {
    showcase,
    devices: {
      iphone: { image: clip(kv?.devices?.iphone?.image) },
      laptop: { image: clip(kv?.devices?.laptop?.image) },
    },
    creatorVideo: clip(kv?.creatorVideo),
  };
}

/** Validate + persist site content (everything in the DB). */
export async function writeContent(obj) {
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

  try {
    await saveVideos(showcaseData);
  } catch (err) {
    console.error('Failed to save videos to DB:', err);
  }

  const kv = {
    devices: {
      iphone: { image: clip(obj?.devices?.iphone?.image) },
      laptop: { image: clip(obj?.devices?.laptop?.image) },
    },
    creatorVideo: clip(obj?.creatorVideo),
  };
  await saveSiteContent(kv);

  return { showcase: showcaseData, ...kv };
}
