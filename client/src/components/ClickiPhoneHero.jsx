import { useEffect, useRef } from 'react';

/**
 * Sticky-canvas layer for the 3D iPhone hero (see lib/clickiPhone3d.js).
 * Mounted by <ClickiPhoneStage> — not used standalone. Loads three.js (a new,
 * fairly heavy dependency) only when the hero is actually about to be seen,
 * and only on hardware that can plausibly render it smoothly:
 *   - skipped entirely on `prefers-reduced-motion: reduce`
 *   - skipped on `hardwareConcurrency <= 2` (low-end devices)
 *   - otherwise lazy-imported once the stage enters the viewport
 * On any of those paths, `onActive` never fires and the caller's static
 * fallback (already-real content, not a placeholder) stays visible in `slot`.
 */
export default function ClickiPhoneHero({ stageRef, slotRef, beatsSelector = '.phone-beat', modelUrl, screens, onActive }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const weakDevice = (navigator.hardwareConcurrency || 4) <= 2;
    if (reduced || weakDevice) return undefined;

    let cancelled = false;
    let instance = null;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        import('../lib/clickiPhone3d.js')
          .then(({ mountClickiPhone }) => {
            if (cancelled || !canvasRef.current) return;
            instance = mountClickiPhone({
              canvas: canvasRef.current,
              stage,
              slot: slotRef.current,
              beats: stage.querySelectorAll(beatsSelector),
              modelUrl,
              screens,
            });
            onActive?.(true);
          })
          .catch((e) => console.warn('[clicki-phone] failed to load', e));
      },
      { rootMargin: '200px' }
    );
    io.observe(stage);

    return () => {
      cancelled = true;
      io.disconnect();
      instance?.destroy();
      onActive?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageRef, slotRef, beatsSelector, modelUrl]);

  return (
    <div className="phone3d-layer" aria-hidden="true">
      <canvas ref={canvasRef} className="phone3d-canvas" />
    </div>
  );
}
