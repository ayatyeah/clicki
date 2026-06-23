import { useEffect, useRef } from 'react';

/* Soft gradient orbs in the brand palette — premium "investor teaser" backdrop.
   depth = mouse-parallax px, depthY = scroll-parallax factor. */
const ORBS = [
  { tone: 'violet', top: '-12%', left: '-8%', size: 560, depth: 26, depthY: 0.05 },
  { tone: 'green', top: '44%', left: '76%', size: 520, depth: 40, depthY: 0.07 },
  { tone: 'lavender', top: '72%', left: '-10%', size: 460, depth: 22, depthY: 0.05 },
  { tone: 'violet', top: '4%', left: '64%', size: 380, depth: 52, depthY: 0.09 },
];

// A few crisp accent dots for subtle depth.
const DOTS = [
  { tone: 'violet', top: '24%', left: '14%', size: 10, depth: 60, depthY: 0.12 },
  { tone: 'green', top: '68%', left: '88%', size: 12, depth: 70, depthY: 0.14 },
  { tone: 'green', top: '16%', left: '82%', size: 8, depth: 54, depthY: 0.1 },
  { tone: 'violet', top: '82%', left: '40%', size: 9, depth: 64, depthY: 0.13 },
];

/**
 * Fixed premium backdrop: blurred brand-colour orbs that drift toward the
 * pointer and shift on scroll, so the opening screen feels alive without noise.
 * pointer-events:none, behind all content.
 */
export default function Playground() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let scrollRaf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    // rAF-batched so a burst of scroll events writes the var at most once a frame.
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        el.style.setProperty('--scroll', String(window.scrollY));
      });
    };
    const tick = () => {
      raf = 0;
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      el.style.setProperty('--mx', cx.toFixed(3));
      el.style.setProperty('--my', cy.toFixed(3));
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(tick);
    };

    onScroll();
    if (!reduce) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
    };
  }, []);

  return (
    <div className="playground" ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
      {ORBS.map((o, i) => (
        <span
          key={`orb-${i}`}
          className={`pg-orb pg-orb--${o.tone}`}
          style={{
            top: o.top,
            left: o.left,
            // Adaptive: capped in px on desktop, scales down with the viewport on mobile.
            width: `min(${o.size}px, ${Math.round(o.size / 11)}vw)`,
            height: `min(${o.size}px, ${Math.round(o.size / 11)}vw)`,
            '--depth': `${o.depth}px`,
            '--depthY': o.depthY,
          }}
        />
      ))}
      {DOTS.map((d, i) => (
        <span
          key={`dot-${i}`}
          className={`pg-dot pg-dot--${d.tone}`}
          style={{ top: d.top, left: d.left, width: d.size, height: d.size, '--depth': `${d.depth}px`, '--depthY': d.depthY }}
        />
      ))}
    </div>
  );
}
