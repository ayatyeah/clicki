import { useEffect, useRef, useState } from 'react';
import { useContent } from '../content.jsx';

/**
 * Showcase feed (ТЗ 5.11 / 7.3). Pulls items from the CMS (`content.showcase`,
 * managed in /admin); renders placeholders when empty. Each card adopts the
 * media's real aspect ratio, so widescreen and vertical clips both display
 * without cropping. Videos autoplay muted in view; unmute on click.
 */
export default function VideoShowcase({ items }) {
  const content = useContent();
  const list = items && items.length ? items : content.showcase;
  const cards = list && list.length ? list : PLACEHOLDERS;
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const videos = root.querySelectorAll('video');
    if (!videos.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const v = entry.target;
          if (entry.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: 0.6 }
    );
    videos.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [cards]);

  return (
    <div className="showcase" ref={containerRef}>
      {cards.map((item, i) => (
        <ShowcaseItem item={item} key={item.src || i} />
      ))}
    </div>
  );
}

/** One card - sizes itself to the media's natural aspect ratio once known. */
function ShowcaseItem({ item }) {
  const [ratio, setRatio] = useState(null);
  const style = ratio ? { aspectRatio: String(ratio) } : undefined;

  if (item.type === 'image' && item.src) {
    return (
      <article className="showcase__card" style={style}>
        <img
          src={item.src}
          alt=""
          loading="lazy"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w && h) setRatio(w / h);
          }}
        />
      </article>
    );
  }

  if (item.src) {
    return (
      <article className="showcase__card" style={style}>
        <video
          src={item.src}
          poster={item.poster}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            const { videoWidth: w, videoHeight: h } = e.currentTarget;
            if (w && h) setRatio(w / h);
          }}
          onClick={(e) => {
            e.currentTarget.muted = !e.currentTarget.muted;
          }}
        />
      </article>
    );
  }

  return (
    <article className="showcase__card">
      <div className="showcase__placeholder" aria-label="Превью видео">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </article>
  );
}

// Visual placeholders until real previews are uploaded via the admin panel.
const PLACEHOLDERS = Array.from({ length: 6 }, (_, i) => ({ id: `ph-${i}` }));
