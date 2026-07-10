import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-screen image viewer. Opens screenshots (and any image) over the page
 * instead of navigating away to a raw file: dark backdrop, zoom toggle, prev/next
 * through a series, keyboard (← → Esc), and a "3 / 12" counter with a caption.
 *
 * Controlled: parent owns `items` (array of { src, caption }) and the open
 * `index` (null = closed). Rendered through a portal so it sits above everything
 * regardless of where it's mounted.
 */
export default function Lightbox({ items, index, onClose, onIndexChange }) {
  const [zoomed, setZoomed] = useState(false);
  const open = index !== null && index !== undefined && items?.[index];

  const go = useCallback(
    (delta) => {
      if (!items?.length) return;
      const next = (index + delta + items.length) % items.length;
      setZoomed(false);
      onIndexChange?.(next);
    },
    [index, items, onIndexChange]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    // Lock background scroll while the viewer is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, go, onClose]);

  useEffect(() => {
    setZoomed(false);
  }, [index]);

  if (!open) return null;
  const item = items[index];
  const many = items.length > 1;

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lightbox__close" aria-label="Закрыть" onClick={onClose}>✕</button>
      {many && (
        <>
          <button className="lightbox__nav lightbox__nav--prev" aria-label="Предыдущий" onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
          <button className="lightbox__nav lightbox__nav--next" aria-label="Следующий" onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
        </>
      )}
      <figure className="lightbox__stage" onClick={(e) => e.stopPropagation()}>
        <img
          className={`lightbox__img ${zoomed ? 'is-zoomed' : ''}`}
          src={item.src}
          alt={item.caption || ''}
          onClick={() => setZoomed((z) => !z)}
          title={zoomed ? 'Клик — уменьшить' : 'Клик — увеличить'}
        />
        {(item.caption || many) && (
          <figcaption className="lightbox__caption">
            {many && <span className="lightbox__counter">{index + 1} / {items.length}</span>}
            {item.caption && <span>{item.caption}</span>}
          </figcaption>
        )}
      </figure>
    </div>,
    document.body
  );
}
