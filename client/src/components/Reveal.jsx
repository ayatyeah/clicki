import { createElement } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Scroll-reveal wrapper (ТЗ 9.4). Slides + fades its children up as they enter
 * the viewport — applied across the whole site via Section/cards/hero/cta.
 * Honors prefers-reduced-motion (renders static).
 */
export default function Reveal({ children, as = 'div', className = '', delay = 0 }) {
  const reduce = useReducedMotion();
  if (reduce) return createElement(as, { className }, children);

  const MotionTag = motion[as] ?? motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}
