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
const TIP_W = 320;
const EDGE = 12; // smallest gap the card may leave to the edge of the screen

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
  const [tipH, setTipH] = useState(0);
  // Steps carry onEnter closures that the caller rebuilds on every render;
  // holding them in a ref keeps them out of the effect deps, which would
  // otherwise re-fire the step (and its tab switch) forever.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const measure = useCallback(() => {
    const el = visibleTarget(stepsRef.current[i]?.target);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    return setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [i]);

  const total = steps.length;
  const next = useCallback(() => setI((n) => Math.min(n + 1, total - 1)), [total]);
  const prev = useCallback(() => setI((n) => Math.max(n - 1, 0)), []);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  // Measure the card rather than assume a height. Steps differ in length, and a
  // guess is what let a long one slide off the top of a short window: it was
  // pinned by its bottom edge to sit above the target, with nothing stopping the
  // other end.
  //
  // An observer rather than a measure-on-render: the height changes for reasons a
  // dependency list doesn't see — a new step's text, a narrower window rewrapping
  // it, a late font. Setting the same height again is a no-op, so it settles.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setTipH(el.offsetHeight));
    ro.observe(el);
    setTipH(el.offsetHeight);
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
    visibleTarget(step.target)?.scrollIntoView({ block: 'center' });
    measure();
    const t = setTimeout(measure, 260);
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

  // Under the element when it fits, over it otherwise, centred with no element —
  // but clamped to the screen either way, so a tall card in a short window (a
  // phone turned sideways) gives up its position before it gives up its title.
  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  let tipStyle = {};
  if (rect) {
    const fitsBelow = rect.top + rect.height + PAD + GAP + tipH < window.innerHeight - EDGE;
    const wanted = fitsBelow
      ? rect.top + rect.height + PAD + GAP
      : rect.top - PAD - GAP - tipH;
    tipStyle = {
      left: clamp(rect.left + rect.width / 2 - TIP_W / 2, EDGE, window.innerWidth - TIP_W - EDGE),
      top: clamp(wanted, EDGE, window.innerHeight - tipH - EDGE),
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
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Пропустить</button>
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
