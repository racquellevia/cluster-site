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
  shapePoints({ src: "shapes/logo-blob.png", fallback: "scatter" }, coarse ? 3500 : 5200),
]);
const cloud = startCloud(document.querySelector("#cloud"), sections, N, initial, markPts);

const expectIndex = sections.findIndex((el) => el.id === "expect");
// keeps --expect-shape-bottom (the chevrons.png shape's rendered bottom edge)
// live for the "Submit a Lightning Talk" button, see .side-cta in style.css
function updateCtaOffset() {
  document.documentElement.style.setProperty(
    "--expect-shape-bottom",
    `${cloud.shapeBottomPx(expectIndex)}px`,
  );
}

sections.forEach((el, i) => {
  if (i === 0) return; // hero: cloud.js pins the mark blob and parks the morph cloud offscreen
  shapePoints({ src: el.dataset.shapeSrc, fallback: el.dataset.shape }, N).then((pts) => {
    cloud.setTarget(i, pts);
    if (i === expectIndex) updateCtaOffset();
  });
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
let docked = false; // true once shrunk into the fixed header (see .lockup.docked)

const endScale = () => Math.min(200, innerWidth * 0.45) / flow.width;

function measureLockup() {
  lockup.classList.remove("docked"); // restore normal flow so we measure the true rect
  docked = false;
  lockup.style.transform = "none";
  const r = lockup.getBoundingClientRect();
  flow = { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height };
  placeLockup();
}

function setHeader(kEnd, e) {
  const headerH = flow.height * kEnd + PAD * 1.4; // PAD above, ~0.4·PAD below
  headerBg.style.height = `${headerH}px`;
  headerBg.style.opacity = e;
  // sections read this to clear the docked header
  document.documentElement.style.setProperty("--header-h", `${headerH}px`);
}

// Once fully shrunk, hand pinning to the browser: position:fixed + a
// scroll-independent transform. Recomputing the transform every scroll frame
// (needed only while the lockup is still in flow) is what made it wiggle.
function dock() {
  docked = true;
  const kEnd = endScale();
  lockup.classList.add("docked");
  lockup.style.transform = `translate(${PAD}px, ${PAD}px) scale(${kEnd})`;
  setHeader(kEnd, 1);
}

function placeLockup() {
  const p = Math.min(1, Math.max(0, scrollY / (hero.offsetHeight * 0.55)));
  if (p >= 1) {
    if (!docked) dock();
    return; // docked: fixed position + constant transform, nothing to update
  }
  if (docked) {
    docked = false;
    lockup.classList.remove("docked");
  }
  const e = p * p * (3 - 2 * p); // smoothstep
  const kEnd = endScale();
  const k = 1 + e * (kEnd - 1);
  const y0 = flow.top - scrollY; // where the lockup would sit if left in flow
  lockup.style.transform = `translate(${(PAD - flow.left) * e}px, ${(PAD - y0) * e}px) scale(${k})`;
  setHeader(kEnd, e);
}

// Update the lockup once per render frame (not on scroll events) so its CSS
// transform and the WebGL mark blob that tracks it are computed from the same
// scrollY in the same frame — the scroll-event/rAF desync is what made the mark
// wiggle while docking. Skip frames where scrollY didn't move.
let lastScrollY = -1;
cloud.setPreFrame(() => {
  if (scrollY === lastScrollY) return;
  lastScrollY = scrollY;
  placeLockup();
});

function layoutHero() {
  fitLede();
  measureLockup();
  updateCtaOffset(); // cloud.js's own resize handler (registered first) has already re-run
}
layoutHero();
addEventListener("resize", layoutHero);
addEventListener("load", layoutHero); // dev: stylesheet may apply after module runs
document.fonts.ready.then(() => requestAnimationFrame(layoutHero));
