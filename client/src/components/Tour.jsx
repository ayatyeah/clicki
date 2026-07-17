import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Coach-mark tour: dims the cabinet, cuts a hole around one element at a time
 * and explains it, with Далее / Назад.
 *
 * The twin of ./Guide.jsx — one guide to read, one to walk — so steps are plain
 * data in the same spirit (content/guides.js):
 *   { target?: 'css selector', title, body: string | string[], onEnter?: () => void }
 *
 * A step with no target, or whose target isn't on screen, renders as a centred
 * card instead of being skipped: a creator with no orders yet should still be
 * told what the Заказы tab is for.
 *
 * `target` is allowed to match several elements on purpose. The cabinets render
 * every nav item twice — desktop sidebar and mobile bottom bar — and hide one by
 * viewport, so the tour spotlights whichever is actually on screen.
 */

const PAD = 8; // breathing room between the element and the edge of the hole
const GAP = 12; // hole → tooltip
const EDGE = 12; // smallest gap the card may leave to the edge of the screen
const MIN_TIP_H = 120; // never squeeze the card to nothing, even beside a huge target

/**
 * First match that has a real box — display:none collapses to 0×0, which is
 * exactly what tells the hidden copy of a nav item from the shown one. A rect
 * also stays right for a fixed-position target, whose offsetParent is null.
 */
function visibleTarget(selector) {
  if (!selector) return null;
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export default function Tour({ steps, open, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const tipRef = useRef(null);
  const [tipW, setTipW] = useState(0);
  // Steps carry onEnter closures that the caller rebuilds on every render;
  // holding them in a ref keeps them out of the effect deps, which would
  // otherwise re-fire the step (and its tab switch) forever.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const measure = useCallback(() => {
    const el = visibleTarget(stepsRef.current[i]?.target);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    // A target that has scrolled out of the viewport gets no spotlight: a hole cut
    // off-screen points at nothing and drags the card out with it. Falling back to
    // the centred card at least keeps the step readable.
    const onScreen = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    if (!onScreen) return setRect(null);
    return setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [i]);

  const total = steps.length;
  const next = useCallback(() => setI((n) => Math.min(n + 1, total - 1)), [total]);
  const prev = useCallback(() => setI((n) => Math.max(n - 1, 0)), []);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  // Only the width, and only because centring needs a number. The height is
  // deliberately never measured: see the placement below.
  //
  // An observer rather than a measure-on-render, because the width belongs to CSS
  // (there is a full-width rule for phones) and changes on a resize that no
  // dependency list would catch. Re-setting the same width is a no-op.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return undefined;
    const read = () => setTipW((w) => (w === el.offsetWidth ? w : el.offsetWidth));
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, [open]);

  // Enter a step: run its side effect (usually "open this tab"), bring the target
  // into view, measure now, then measure again once anything triggered above has
  // settled.
  useEffect(() => {
    if (!open) return undefined;
    const step = stepsRef.current[i];
    if (!step) return undefined;
    step.onEnter?.();
    const reveal = () => {
      visibleTarget(step.target)?.scrollIntoView({ block: 'center' });
      measure();
    };
    reveal();
    // onEnter usually swaps the tab, and React renders that after this effect —
    // so the scroll above was aimed at the old layout, and by the time the new one
    // lands the target can be somewhere else entirely (off-screen, on a short
    // window). Scrolling again once it has settled is what keeps the spotlight on
    // something the creator can actually see. Measuring alone was not enough: it
    // faithfully reported a target that had scrolled away.
    const t = setTimeout(reveal, 260);
    return () => clearTimeout(t);
  }, [open, i, measure]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    // Capture, so scrolling an inner pane moves the spotlight too.
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, measure, next, prev, onClose]);

  if (!open || !steps.length) return null;
  const step = steps[i];
  if (!step) return null;
  const last = i === total - 1;

  // Whichever side of the element has more room, capped to that room — centred
  // when there is no element.
  //
  // Anchored by the near edge (top below the element, bottom above it) and never
  // by a computed height: the card's height is the browser's business, and asking
  // for it first is what broke this. A step's text changes its height, so for one
  // frame the new, taller card was still positioned by the old card's height and
  // hung off the screen; the measurement only caught up afterwards. Anchoring the
  // near edge plus max-height means the layout is right in a single pass, and a
  // card with nowhere to fit scrolls its text instead of leaving the screen.
  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  let tipStyle = {};
  if (rect) {
    const roomAbove = rect.top - PAD - GAP - EDGE;
    const roomBelow = window.innerHeight - (rect.top + rect.height + PAD + GAP) - EDGE;
    const below = roomBelow >= roomAbove;
    tipStyle = {
      left: clamp(rect.left + rect.width / 2 - tipW / 2, EDGE, window.innerWidth - tipW - EDGE),
      maxHeight: Math.max(MIN_TIP_H, below ? roomBelow : roomAbove),
      ...(below
        ? { top: rect.top + rect.height + PAD + GAP }
        : { bottom: window.innerHeight - rect.top + PAD + GAP }),
    };
  }

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div
          className="tour__spot"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      ) : (
        <div className="tour__scrim" />
      )}
      <div ref={tipRef} className={`tour__tip${rect ? '' : ' tour__tip--center'}`} style={tipStyle}>
        <span className="tour__count">Шаг {i + 1} из {total}</span>
        <h3 className="tour__title">{step.title}</h3>
        {[].concat(step.body || []).map((line, j) => (
          <p className="tour__text" key={j}>{line}</p>
        ))}
        <div className="tour__actions">
          {/* A quiet link, not a third pill: three buttons of equal weight did not
              fit the card, and skipping was never the equal of Далее anyway. */}
          <button type="button" className="tour__skip" onClick={onClose}>Пропустить</button>
          <div className="tour__navbtns">
            {i > 0 && <button type="button" className="btn btn--ghost btn--sm" onClick={prev}>Назад</button>}
            <button type="button" className="btn btn--primary btn--sm" onClick={last ? onClose : next}>
              {last ? 'Готово' : 'Далее'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
