import { useEffect, useRef, useState } from 'react';

/**
 * Square avatar/logo cropper. Takes a raw File, lets the user drag + zoom to
 * frame it, and returns a small (512×512) JPEG Blob via onConfirm. Doing the
 * resize client-side keeps big phone photos well under the upload limit (and
 * guarantees a square image that renders cleanly in the round/rounded frames).
 */
const BOX = 264; // on-screen crop viewport (px)
const OUT = 512; // exported image size (px)

export default function AvatarCropper({ file, onCancel, onConfirm, round = true }) {
  const [url, setUrl] = useState('');
  const [img, setImg] = useState(null);
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const image = new Image();
    image.onload = () => {
      const s = Math.max(BOX / image.width, BOX / image.height); // cover
      setImg(image);
      setMinScale(s);
      setScale(s);
      setOffset({ x: (BOX - image.width * s) / 2, y: (BOX - image.height * s) / 2 });
    };
    image.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Modal behavior: Escape closes it and body scroll is locked while it's open
  // (consistent with the other dialogs).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  // Keep the image covering the whole box (no empty gaps).
  const clamp = (o, s) => {
    if (!img) return o;
    const w = img.width * s;
    const h = img.height * s;
    return { x: Math.min(0, Math.max(BOX - w, o.x)), y: Math.min(0, Math.max(BOX - h, o.y)) };
  };

  const onDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.sx), y: drag.current.oy + (e.clientY - drag.current.sy) }, scale));
  };
  const onUp = () => { drag.current = null; };

  const onZoom = (e) => {
    const s = Number(e.target.value);
    // Zoom around the box centre so it feels natural.
    const cx = BOX / 2;
    const cy = BOX / 2;
    setOffset((o) => clamp({ x: cx - ((cx - o.x) / scale) * s, y: cy - ((cy - o.y) / scale) * s }, s));
    setScale(s);
  };

  const confirm = () => {
    if (!img) return;
    setBusy(true);
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    const sw = BOX / scale;
    const sh = BOX / scale;
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT, OUT);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onConfirm(blob);
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <div className="cropper__backdrop" onClick={onCancel} role="dialog" aria-modal="true" aria-label="Настрой фото">
      <div className="cropper" onClick={(e) => e.stopPropagation()}>
        <h3 className="cropper__title">Настрой фото</h3>
        <p className="cropper__hint">Перетащи и приблизь, чтобы выбрать область.</p>
        <div
          className="cropper__box"
          style={{ width: BOX, height: BOX, borderRadius: round ? '50%' : '18px' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          {url && img && (
            <img
              className="cropper__img"
              src={url}
              alt=""
              draggable="false"
              style={{ width: img.width * scale, height: img.height * scale, transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
            />
          )}
          <div className="cropper__ring" aria-hidden="true" style={{ borderRadius: round ? '50%' : '18px' }} />
        </div>
        <input
          className="cropper__zoom"
          type="range"
          min={minScale}
          max={minScale * 3.5}
          step="0.001"
          value={scale}
          onChange={onZoom}
          aria-label="Приближение"
        />
        <div className="cropper__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={busy}>Отмена</button>
          <button type="button" className="btn btn--primary btn--sm" onClick={confirm} disabled={busy || !img}>{busy ? '…' : 'Готово'}</button>
        </div>
      </div>
    </div>
  );
}
