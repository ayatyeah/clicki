import { useEffect, useRef } from 'react';

/**
 * Vertical 9:16 video showcase (ТЗ 5.11 / 7.3).
 * Autoplays muted previews when scrolled into view, pauses when out.
 * Content is normally fed from the CMS/admin (ТЗ 7.5); here it accepts an
 * `items` prop and renders placeholders when no media is configured yet.
 */
export default function VideoShowcase({ items = [] }) {
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
  }, [items]);

  const cards = items.length ? items : PLACEHOLDERS;

  return (
    <div className="showcase" ref={containerRef}>
      {cards.map((item, i) => (
        <article className="showcase__card" key={item.id || i}>
          {item.src ? (
            <video
              src={item.src}
              poster={item.poster}
              muted
              loop
              playsInline
              preload="none"
              onClick={(e) => {
                e.currentTarget.muted = !e.currentTarget.muted;
              }}
            />
          ) : (
            <div className="showcase__placeholder" aria-label="Превью видео">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

// Visual placeholders until real previews are uploaded via the admin panel.
const PLACEHOLDERS = Array.from({ length: 6 }, (_, i) => ({ id: `ph-${i}` }));
