import { useEffect, useRef } from 'react';

/* ----------------------------------------------------------------
   Flat doodle sprites — sticker-pack style, accent-colored.
   ---------------------------------------------------------------- */
const C = {
  cornflower: '#4fbeff',
  tangerine: '#f26110',
  amethyst: '#9552e0',
  mustard: '#bb9915',
  ink: '#0a0d12',
  white: '#ffffff',
};

function Cloud({ color }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 120 70" fill="none">
      <path
        d="M30 58c-14 0-24-9-24-21 0-11 9-20 21-20 3-9 12-15 22-15 13 0 23 9 25 21 11 1 19 9 19 19 0 10-9 17-21 17H30z"
        fill={color}
      />
    </svg>
  );
}
function Plane({ color }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 90 90" fill="none">
      <path d="M82 8 8 40l30 9 9 30 35-71z" fill={color} />
      <path d="M38 49 82 8 47 79l-9-30z" fill={C.white} opacity="0.55" />
    </svg>
  );
}
function Star({ color }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 60 60" fill="none">
      <path d="M30 2c3 16 12 25 28 28-16 3-25 12-28 28-3-16-12-25-28-28 16-3 25-12 28-28z" fill={color} />
    </svg>
  );
}
function Heart({ color }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 60 56" fill="none">
      <path d="M30 54C12 40 4 31 4 19 4 10 11 4 19 4c5 0 9 2 11 6 2-4 6-6 11-6 8 0 15 6 15 15 0 12-8 21-26 35z" fill={color} />
    </svg>
  );
}
function Blob({ color }) {
  // Emoji-faced blob character.
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
      <path
        d="M50 6c22 0 40 16 40 39 0 26-16 49-40 49S10 71 10 45C10 22 28 6 50 6z"
        fill={color}
      />
      <circle cx="38" cy="46" r="5" fill={C.ink} />
      <circle cx="62" cy="46" r="5" fill={C.ink} />
      <path d="M38 62c4 6 20 6 24 0" stroke={C.ink} strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function Sparkle({ color }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40" fill="none">
      <path d="M20 2l4 14 14 4-14 4-4 14-4-14-14-4 14-4 4-14z" fill={color} />
    </svg>
  );
}
function Ring({ color }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 70 70" fill="none">
      <circle cx="35" cy="35" r="28" stroke={color} strokeWidth="8" fill="none" />
    </svg>
  );
}

const SPRITES = { Cloud, Plane, Star, Heart, Blob, Sparkle, Ring };

/* Scattered like confetti, not on a grid. depth = mouse parallax px,
   depthY = scroll parallax factor, dur = float speed. */
const DOODLES = [
  { type: 'Blob', color: C.cornflower, top: '14%', left: '8%', size: 92, depth: 26, depthY: 0.05, dur: 7 },
  { type: 'Plane', color: C.tangerine, top: '20%', left: '82%', size: 76, depth: 40, depthY: 0.12, dur: 9, spin: false },
  { type: 'Cloud', color: '#cce7ff', top: '8%', left: '54%', size: 120, depth: 16, depthY: 0.03, dur: 11 },
  { type: 'Star', color: C.mustard, top: '30%', left: '30%', size: 44, depth: 34, depthY: 0.08, dur: 6 },
  { type: 'Heart', color: C.amethyst, top: '62%', left: '12%', size: 50, depth: 30, depthY: 0.1, dur: 8 },
  { type: 'Blob', color: C.amethyst, top: '70%', left: '86%', size: 80, depth: 28, depthY: 0.06, dur: 7.5 },
  { type: 'Sparkle', color: C.cornflower, top: '48%', left: '92%', size: 34, depth: 44, depthY: 0.14, dur: 5 },
  { type: 'Cloud', color: '#e4ccff', top: '78%', left: '44%', size: 110, depth: 14, depthY: 0.04, dur: 12 },
  { type: 'Ring', color: C.tangerine, top: '40%', left: '6%', size: 56, depth: 22, depthY: 0.07, dur: 9, spin: true },
  { type: 'Star', color: C.cornflower, top: '86%', left: '70%', size: 38, depth: 36, depthY: 0.1, dur: 6.5 },
  { type: 'Sparkle', color: C.mustard, top: '12%', left: '36%', size: 28, depth: 40, depthY: 0.12, dur: 5.5 },
  { type: 'Blob', color: C.tangerine, top: '52%', left: '62%', size: 64, depth: 24, depthY: 0.05, dur: 8.5 },
];

/**
 * Playful pastel-sky backdrop — the opening "hook". Flat doodles scattered
 * across the canvas drift on their own, then parallax toward the pointer and
 * shift as you scroll, so the screen feels alive before a word is read.
 *
 * Fixed behind all content, pointer-events:none, zero layout cost.
 */
export default function Playground() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      el.style.setProperty('--scroll', String(window.scrollY));
    };
    const tick = () => {
      raf = 0;
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty('--mx', cx.toFixed(3));
      el.style.setProperty('--my', cy.toFixed(3));
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
        raf = requestAnimationFrame(tick);
      }
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
    };
  }, []);

  return (
    <div className="playground" ref={ref} aria-hidden="true">
      {DOODLES.map((d, i) => {
        const Sprite = SPRITES[d.type];
        return (
          <div
            key={i}
            className={`doodle ${d.spin ? 'doodle--spin' : ''}`}
            style={{
              top: d.top,
              left: d.left,
              width: d.size,
              height: d.size,
              '--depth': `${d.depth}px`,
              '--depthY': d.depthY,
            }}
          >
            <span
              className="doodle__inner"
              style={{ '--dur': `${d.dur}s`, '--delay': `${(i % 5) * -0.7}s`, width: '100%', height: '100%' }}
            >
              <Sprite color={d.color} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
