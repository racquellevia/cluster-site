import { animate, stagger, onScroll, utils } from "animejs";

// Per-section copy entrance: fade + rise with a slight stagger,
// triggered when the section scrolls into view. Runs once.
export function initTextAnimations() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".panel .copy").forEach((copy) => {
    // exclude the lockup's children (the "Cluster" wordmark + lede): they
    // double as the docked header (see main.js), which must be visible
    // immediately on any scroll position, including a reload that lands
    // mid-page — an onScroll-triggered fade would never fire since the hero
    // never scrolls back into view in that case, leaving the header blank
    const lines = copy.querySelectorAll(":scope > :not(.lockup)");
    utils.set(lines, { opacity: 0 });
    animate(lines, {
      opacity: [0, 1],
      y: reduceMotion ? 0 : [28, 0],
      duration: reduceMotion ? 200 : 800,
      delay: stagger(110),
      ease: "outExpo",
      autoplay: onScroll({ target: copy }),
    });
  });
}
