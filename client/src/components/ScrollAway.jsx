import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';

/**
 * Scroll-linked "drift down + fade out" wrapper. As the element scrolls toward
 * the top of the viewport it sinks by `distance`px and fades away — the same
 * kind of scroll-driven motion as the MacBook. Honors reduced-motion.
 */
export default function ScrollAway({ children, className = '', distance = 220 }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, distance]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div ref={ref} className={className} style={{ y, opacity }}>
      {children}
    </motion.div>
  );
}
