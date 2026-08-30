"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface ContainerTextFlipProps {
  /** Array of words to cycle through in the animation */
  words?: string[];
  /** Time in milliseconds between word transitions */
  interval?: number;
  /** Additional CSS classes to apply to the container */
  className?: string;
  /** Additional CSS classes to apply to the text */
  textClassName?: string;
  /** Duration of the transition animation in milliseconds */
  animationDuration?: number;
}

/**
 * Word-flip badge in the funnel heroes. The pill widens to fit the current word
 * while its letters blur-fade in with a small stagger.
 *
 * Originally built on `motion` layout animations. It was rewritten on a plain
 * width transition + CSS keyframes because it and <Reveal> were the only two
 * things pulling that ~97 KB library into /business and /creators — a decorative
 * badge is not worth a third of the funnel's JS. Keyframes live in
 * styles/index.css (`.ctf-letter`).
 */
export function ContainerTextFlip({
  words = ["better", "modern", "beautiful", "awesome"],
  interval = 3000,
  className,
  textClassName,
  animationDuration = 700,
}: ContainerTextFlipProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const textRef = useRef<HTMLSpanElement>(null);

  // Layout effect, not effect: the measurement has to land in the same frame the
  // new word paints, otherwise the pill visibly snaps to the old width first.
  useLayoutEffect(() => {
    if (textRef.current) setWidth(textRef.current.scrollWidth + 30);
  }, [currentWordIndex, words]);

  useEffect(() => {
    if (words.length < 2) return undefined;
    const id = setInterval(
      () => setCurrentWordIndex((i) => (i + 1) % words.length),
      interval,
    );
    return () => clearInterval(id);
  }, [words, interval]);

  const word = words[currentWordIndex] ?? "";

  return (
    <div
      style={{
        width: width ? `${width}px` : undefined,
        transitionDuration: `${animationDuration / 2}ms`,
      }}
      className={cn(
        "relative inline-block overflow-hidden rounded-lg border-2 border-transparent pt-2 pb-3 text-center text-4xl font-bold text-white transition-[width] ease-out md:text-7xl",
        // dark fill + violet gradient outline (padding-box / border-box trick)
        "[background:linear-gradient(#1b1335,#120c28)_padding-box,linear-gradient(135deg,#c4b5fd,#7c3aed_55%,#4c1d95)_border-box]",
        "shadow-[0_10px_30px_-10px_rgba(124,58,237,0.55)]",
        className,
      )}
    >
      {/* Remounting on the word (key) is what replays the per-letter keyframes. */}
      <span key={word} ref={textRef} className={cn("inline-block whitespace-nowrap", textClassName)}>
        {word.split("").map((letter, index) => (
          <span
            key={index}
            className="ctf-letter"
            style={{ animationDelay: `${index * 20}ms` }}
          >
            {letter === " " ? " " : letter}
          </span>
        ))}
      </span>
    </div>
  );
}
