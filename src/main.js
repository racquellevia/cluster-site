import "./style.css";
import { shapePoints } from "./sample.js";
import { startCloud } from "./cloud.js";
import { initTextAnimations } from "./text.js";

const coarse = matchMedia("(pointer: coarse)").matches;
const N = coarse ? 6000 : 14000;

const sections = [...document.querySelectorAll(".panel[data-shape]")];

// Render immediately with the hero's procedural shape; swap in each
// section's real shape (image-sampled or procedural) as it resolves.
// The logo mark blob is sampled from its own image (scatter as fallback).
const [initial, markPts] = await Promise.all([
  shapePoints({ fallback: sections[0].dataset.shape }, N),
  shapePoints({ src: "shapes/logo-blob.png", fallback: "scatter" }, coarse ? 3000 : 4500),
]);
const cloud = startCloud(document.querySelector("#cloud"), sections, N, initial, markPts);

sections.forEach((el, i) => {
  if (i === 0) return; // hero: cloud.js pins the mark blob and parks the morph cloud offscreen
  shapePoints({ src: el.dataset.shapeSrc, fallback: el.dataset.shape }, N).then(
    (pts) => cloud.setTarget(i, pts),
  );
});

initTextAnimations();

// scale the hero lede so it spans exactly the blob + CLUSTER lockup width
const heroH1 = document.querySelector(".hero h1");
const heroLede = document.querySelector(".hero .lede");
function fitLede() {
  heroLede.style.fontSize = "16px";
  const ratio = heroH1.getBoundingClientRect().width / heroLede.getBoundingClientRect().width;
  heroLede.style.fontSize = `${16 * ratio}px`;
}
// scroll shrinks the lockup (blob + CLUSTER + lede) into a fixed header
// pinned to the upper-left; the cloud's mark blob follows the anchor with it
const lockup = document.querySelector("#lockup");
const headerBg = document.querySelector("#header-bg");
const hero = document.querySelector("#hero");
const PAD = 20; // header inset, px
let flow = { left: 0, top: 0, width: 1, height: 1 }; // lockup's untransformed document rect

function measureLockup() {
  lockup.style.transform = "none";
  const r = lockup.getBoundingClientRect();
  flow = { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height };
  placeLockup();
}

function placeLockup() {
  const p = Math.min(1, Math.max(0, scrollY / (hero.offsetHeight * 0.55)));
  const e = p * p * (3 - 2 * p); // smoothstep
  const kEnd = Math.min(200, innerWidth * 0.45) / flow.width;
  const k = 1 + e * (kEnd - 1);
  const y0 = flow.top - scrollY; // where the lockup would sit if left in flow
  lockup.style.transform = `translate(${(PAD - flow.left) * e}px, ${(PAD - y0) * e}px) scale(${k})`;
  headerBg.style.height = `${flow.height * kEnd + PAD * 1.4}px`; // PAD above, ~0.4·PAD below
  headerBg.style.opacity = e;
}
addEventListener("scroll", placeLockup, { passive: true });

function layoutHero() {
  fitLede();
  measureLockup();
}
layoutHero();
addEventListener("resize", layoutHero);
addEventListener("load", layoutHero); // dev: stylesheet may apply after module runs
document.fonts.ready.then(() => requestAnimationFrame(layoutHero));
