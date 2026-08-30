import { createElement, useEffect, useRef, useState } from 'react';

/**
 * Scroll-reveal wrapper (ТЗ 9.4). Fades + lifts its children as they enter the
 * viewport - applied across the funnel sections (components/funnel/Shinta.jsx).
 * Honors prefers-reduced-motion (renders static).
 *
 * Deliberately hand-rolled on IntersectionObserver instead of `motion`: this was
 * the only remaining consumer of that library on the marketing pages, and it was
 * pulling a ~97 KB chunk into /business and /creators to do a fade-in that ~30
 * lines and two CSS rules cover. See `.reveal` in styles/index.css.
 *
 * Two failure modes are guarded on purpose, because either one leaves a section
 * of the page permanently invisible:
 *   - no IntersectionObserver (very old browser) -> render shown;
 *   - already inside the viewport on mount -> show immediately, without waiting
 *     for the observer's first async callback (this also keeps the hero from
 *     fading in after first paint).
 */
export default function Reveal({ children, as = 'div', className = '', delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return undefined;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const inView = el.getBoundingClientRect().top < window.innerHeight;
    if (reduced || inView || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setShown(true);
      },
      // Trigger a bit before the element's top edge reaches the fold, so the
      // motion finishes roughly as it settles into view rather than after.
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return createElement(
    as,
    {
      ref,
      className: `reveal${shown ? ' is-in' : ''}${className ? ` ${className}` : ''}`,
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children
  );
}
