/**
 * CORE-agnostic hook — generic RAF-based horizontal marquee-scroll engine.
 * No domain knowledge; can drive any duplicated horizontal content strip.
 */
"use client";

import { useEffect, useRef } from "react";

interface UseMarqueeScrollOptions {
  /** Number of source items currently rendered (drives re-attach, since content is duplicated for a seamless loop). */
  itemCount: number;
  /** When true, the scroll position is held in place. */
  paused: boolean;
  /** Pixels moved per ~16ms frame. */
  speed?: number;
}

export function useMarqueeScroll<
  TContainer extends HTMLElement = HTMLDivElement,
  TTrack extends HTMLElement = HTMLDivElement,
>({ itemCount, paused, speed = 0.8 }: UseMarqueeScrollOptions) {
  const containerRef = useRef<TContainer>(null);
  const trackRef = useRef<TTrack>(null);
  const animationRef = useRef<number>(0);
  const positionRef = useRef(0);
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!trackRef.current || !containerRef.current || itemCount === 0) return;

    // Accessibility: no auto-scroll for users who prefer reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lastTime = 0;

    const animate = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const delta = timestamp - lastTime;
      lastTime = timestamp;

      if (!paused && trackRef.current && containerRef.current) {
        positionRef.current -= speedRef.current * (delta / 16);

        const trackWidth = trackRef.current.scrollWidth / 2; // Divided by 2 because content is duplicated

        // Reset position when entire track has scrolled through
        if (Math.abs(positionRef.current) >= trackWidth) {
          positionRef.current = 0;
        }

        trackRef.current.style.transform = `translateX(${positionRef.current}px)`;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [itemCount, paused]);

  return { containerRef, trackRef };
}
