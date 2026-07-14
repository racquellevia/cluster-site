import { animate, stagger, onScroll, utils } from "animejs";

// Per-section copy entrance: fade + rise with a slight stagger,
// triggered when the section scrolls into view. Runs once.
export function initTextAnimations() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".panel .copy").forEach((copy) => {
    // animate the lockup's children, not the lockup itself — main.js owns
    // its transform for the scroll-driven header shrink
    const lines = copy.querySelectorAll(":scope > :not(.lockup), .lockup > *");
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
