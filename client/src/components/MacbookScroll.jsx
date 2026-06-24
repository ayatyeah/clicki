import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * Scroll-driven MacBook that opens + scales as the section scrolls past — a
 * vanilla-CSS adaptation of Aceternity's "MacBook Scroll" (which is Tailwind +
 * Framer Motion), fitted to this project's plain-CSS setup. The screen image is
 * CMS-driven (content.devices.laptop.image).
 */
export default function MacbookScroll({ src = '', title, badge }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Lid starts squashed + tilted back (closed), then opens flat and scales up.
  const scaleX = useTransform(scrollYProgress, [0, 0.3], [1.06, 1.5]);
  const scaleY = useTransform(scrollYProgress, [0, 0.3], [0.5, 1.5]);
  const rotateX = useTransform(scrollYProgress, [0.1, 0.12, 0.3], [-28, -28, 0]);
  const lidOpacity = useTransform(scrollYProgress, [0, 0.05], [0.5, 1]);
  // Title drifts up and fades as the lid takes over.
  const titleY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <div ref={ref} className="mbs">
      <div className="mbs__stage">
        {title && (
          <motion.h2 className="mbs__title" style={{ y: titleY, opacity: titleOpacity }}>
            {title}
          </motion.h2>
        )}

        <div className="mbs__laptop">
          {/* Lid / screen — hinges open from its bottom edge */}
          <motion.div className="mbs__lid" style={{ scaleX, scaleY, rotateX, opacity: lidOpacity }}>
            <div className="mbs__screen">
              <div className="mbs__notch" />
              {src ? <img src={src} alt="" /> : <div className="mbs__screen-fallback" />}
            </div>
          </motion.div>

          {/* Base — keyboard deck + trackpad */}
          <div className="mbs__base" aria-hidden="true">
            <div className="mbs__keyboard">
              {Array.from({ length: 5 }).map((_, r) => (
                <div className="mbs__keyrow" key={r}>
                  {Array.from({ length: 17 }).map((__, k) => (
                    <span className="mbs__key" key={k} />
                  ))}
                </div>
              ))}
              <div className="mbs__keyrow mbs__keyrow--space">
                <span className="mbs__key" />
                <span className="mbs__key mbs__key--space" />
                <span className="mbs__key" />
              </div>
            </div>
            <div className="mbs__trackpad" />
            {badge && <div className="mbs__badge">{badge}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
