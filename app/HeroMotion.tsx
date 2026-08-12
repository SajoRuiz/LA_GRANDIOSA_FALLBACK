"use client";

import { useEffect, useRef } from "react";

import styles from "./page.module.css";

export default function HeroMotion() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    let frame = 0;

    const updateMotion = () => {
      const viewportHeight = window.innerHeight || 1;
      const progress = Math.min(Math.max(window.scrollY / viewportHeight, 0), 1);
      const parallaxX = (progress - 0.5) * 28;
      const parallaxY = progress * 24;
      const spotlightShift = progress * 18;

      root.style.setProperty("--hero-parallax-x", `${parallaxX}px`);
      root.style.setProperty("--hero-parallax-y", `${parallaxY}px`);
      root.style.setProperty("--hero-spotlight-x", `${spotlightShift}px`);
      frame = 0;
    };

    const onScroll = () => {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(updateMotion);
    };

    updateMotion();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateMotion);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateMotion);

      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.heroDecor} aria-hidden="true">
      <span className={styles.heroHalo} />
      <span className={styles.heroGrid} />
      <span className={styles.heroOrbA} />
      <span className={styles.heroOrbB} />
      <span className={styles.heroOrbC} />
      <span className={styles.heroSweep} />
    </div>
  );
}