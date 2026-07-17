import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  CanvasTexture,
  SRGBColorSpace,
  Clock,
} from "three";

const TAU = Math.PI * 2;
const FOV = 40;
const CAM_DIST = 10;

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, TAU);
  ctx.fill();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const smoothstep = (t) => t * t * (3 - 2 * t);

// Two THREE.Points clouds behind the page: a small blob pinned to the hero
// lockup's anchor (which shrinks into the fixed header), and a morphing cloud
// whose position buffer lerps between per-section target shapes (unit-box
// Float32Arrays) as the page scrolls — starting from an offscreen ring at the
// hero so section 1's shape flies in from outside the frame.
export function startCloud(canvas, sectionEls, N, initial, markPts) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));

  // mark blob renders on its own canvas layered above the header wash
  const markRenderer = new WebGLRenderer({
    canvas: document.querySelector("#mark-cloud"),
    alpha: true,
    antialias: false,
  });
  markRenderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));

  const scene = new Scene();
  const markScene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.z = CAM_DIST;

  const tex = dotTexture();

  const geometry = new BufferGeometry();
  const drawn = new Float32Array(N * 3);
  geometry.setAttribute("position", new BufferAttribute(drawn, 3));

  const material = new PointsMaterial({
    color: 0x141414,
    map: tex,
    transparent: true,
    opacity: 0.85,
    alphaTest: 0.4,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  scene.add(points);

  // second, small cloud: the mark blob pinned to the #cloud-anchor box in the
  // hero lockup — it rides along as the lockup shrinks into the fixed header
  // points sampled from the logo-blob image (see main.js), unit-box coords
  const markSrc = markPts;
  const M = markSrc.length / 3;
  const markDrawn = new Float32Array(M * 3);
  const markGeometry = new BufferGeometry();
  markGeometry.setAttribute("position", new BufferAttribute(markDrawn, 3));
  const markMaterial = new PointsMaterial({
    color: 0x141414,
    map: tex,
    transparent: true,
    opacity: 1,
    alphaTest: 0.4,
    depthWrite: false,
    sizeAttenuation: true,
  });
  markScene.add(new Points(markGeometry, markMaterial));

  const targets = sectionEls.map(() => initial);
  const phase = Float32Array.from({ length: N }, () => Math.random() * TAU);

  const markEl = document.querySelector("#cloud-anchor");

  let scale = 1;
  let visW = 1;
  let visH = 1;
  let wide = true;
  let anchors = [];
  // world-space x per section: cloud centered in the negative space between
  // the copy column and the far browser edge (0 on narrow screens / hero)
  let sideX = sectionEls.map(() => 0);

  // per-section size multiplier via data-shape-scale on the section
  const shapeScale = sectionEls.map((el) => parseFloat(el.dataset.shapeScale) || 1);
  // sections whose shape sits small above the copy on narrow screens
  // (mobile copy is bottom-anchored, leaving white space under the header)
  const mobileTop = sectionEls.map((el) => "shapeMobileTop" in el.dataset);
  // extra mobile-top height via data-mobile-stretch-y, growing downward only
  // (toward the copy) — the offset shifts down by the added height so the
  // shape's top edge stays put instead of growing upward too
  const mobileStretchY = sectionEls.map((el) => parseFloat(el.dataset.mobileStretchY) || 1);
  const SHAPE_HALF_HEIGHT = 0.3; // approx local half-height shared by the procedural shapes
  // extra per-section nudges: shift up by N px (data-shape-offset-y) and
  // push back from the camera by N world units (data-shape-depth) — resize()
  // needs this to keep sideX correct at depth, so it's declared before it
  const shapeOffsetYPx = sectionEls.map((el) => parseFloat(el.dataset.shapeOffsetY) || 0);
  const shapeDepth = sectionEls.map((el) => parseFloat(el.dataset.shapeDepth) || 0);
  // per-section dot-radius multiplier (data-dot-scale), independent of
  // shapeScale — lets a shape's footprint and its dot size be tuned apart
  const dotScale = sectionEls.map((el) => parseFloat(el.dataset.dotScale) || 1);

  // hero shape for the morph cloud: dots scattered in a ring beyond the
  // viewport edge, so section 1's shape assembles by flying in from outside
  function offscreenRing() {
    const pts = new Float32Array(N * 3);
    const R = (0.5 * Math.max(visW, visH)) / scale; // viewport half-extent, unit-box units
    // 1.7× clears the viewport corner (≤1.42R) even after perspective pulls
    // far-z points inward
    for (let p = 0; p < N; p++) {
      const a = Math.random() * TAU;
      const r = R * (1.7 + Math.random() * 0.9);
      pts[p * 3] = Math.cos(a) * r;
      pts[p * 3 + 1] = Math.sin(a) * r;
      pts[p * 3 + 2] = (Math.random() - 0.5) * 0.25;
    }
    return pts;
  }

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h);
    markRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    visH = 2 * Math.tan((FOV * Math.PI) / 360) * CAM_DIST;
    visW = visH * camera.aspect;
    scale = 0.62 * Math.min(visW, visH);
    anchors = sectionEls.map((el) => el.offsetTop);
    wide = camera.aspect > 1.05;
    sideX = sectionEls.map((el, i) => {
      if (i === 0 || !wide) return 0;
      const r = el.querySelector(".copy").getBoundingClientRect();
      const onRight = r.left + r.width / 2 > w / 2;
      const cx = onRight ? r.left / 2 : (r.right + w) / 2; // gap midpoint, px
      // a shape pushed back via data-shape-depth is farther from the camera,
      // so perspective pulls its screen position toward center more than a
      // z=0 shape's — scale the world x up to compensate, so it still lands
      // on the same gap-center px as z=0 math (and the .side-cta CSS) would
      const depthFactor = (CAM_DIST - shapeDepth[i]) / CAM_DIST;
      return (cx / w - 0.5) * visW * depthFactor;
    });
    targets[0] = offscreenRing();
  }
  resize();
  addEventListener("resize", resize);
  document.fonts.ready.then(resize); // section offsets shift when ZT Nature loads

  // world-space [x, y, xScale, yScale, dotSize, z] of the morph cloud for section k
  function transform(k) {
    const upOffset = (shapeOffsetYPx[k] / innerHeight) * visH;
    if (!wide && mobileTop[k]) {
      const s = Math.min(visW * 0.9, visH * 0.3) * shapeScale[k];
      const stretchY = mobileStretchY[k];
      const sy = s * stretchY;
      const oy = visH * 0.25 - SHAPE_HALF_HEIGHT * s * (stretchY - 1) + upOffset;
      return [0, oy, s, sy, s * (coarse ? 0.016 : 0.011) * dotScale[k], shapeDepth[k]];
    }
    const s = scale * shapeScale[k];
    return [sideX[k], upOffset, s, s, s * (coarse ? 0.016 : 0.011) * dotScale[k], shapeDepth[k]];
  }

  // viewport px (from the top) of a section's resting shape's lowest point —
  // lets CSS pin UI (e.g. the #expect CTA) just below it, see style.css
  function shapeBottomPx(k) {
    const pts = targets[k];
    const [, oy, , sy, , oz] = transform(k);
    // a shape pushed back via data-shape-depth is farther from the camera,
    // so its visible extent (and thus its y → screen-px mapping) shrinks
    const visHAtZ = visH * ((CAM_DIST - oz) / CAM_DIST);
    let minY = Infinity;
    for (let p = 0; p < pts.length / 3; p++) {
      const y = pts[p * 3 + 1] * sy + oy;
      if (y < minY) minY = y;
    }
    return innerHeight * (0.5 - minY / visHAtZ);
  }

  // scroll position → fractional shape index
  function scrollProgress() {
    const y = scrollY;
    const last = anchors.length - 1;
    for (let i = last - 1; i >= 0; i--) {
      if (y >= anchors[i]) {
        return i + Math.min(1, (y - anchors[i]) / (anchors[i + 1] - anchors[i]));
      }
    }
    return 0;
  }

  let smooth = 0;
  const clock = new Clock();

  // optional per-frame hook run before the blob reads the anchor rect, so the
  // lockup's CSS transform and the WebGL blob are driven by one scrollY sample
  // in the same frame (see main.js) instead of the scroll event vs rAF race
  // that made the mark jitter as it docks
  let preFrame = null;

  function frame() {
    if (preFrame) preFrame();
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;

    smooth = reduceMotion
      ? Math.round(scrollProgress())
      : smooth + (scrollProgress() - smooth) * (1 - Math.exp(-5 * dt));

    const i = Math.max(0, Math.min(targets.length - 1, Math.floor(smooth)));
    const j = Math.min(i + 1, targets.length - 1);
    const a = targets[i];
    const b = targets[j];
    const t = smoothstep(Math.min(1, Math.max(0, smooth - i)));
    const u = 1 - t;

    const [xA, yA, sxA, syA, dA, zA] = transform(i);
    const [xB, yB, sxB, syB, dB, zB] = transform(j);
    const ox = xA * u + xB * t;
    const oy = yA * u + yB * t;
    const oz = zA * u + zB * t;
    const sxNow = sxA * u + sxB * t;
    const syNow = syA * u + syB * t;

    material.size = dA * u + dB * t;

    const amp = reduceMotion ? 0 : sxNow * 0.008;
    for (let p = 0; p < N; p++) {
      const o = p * 3;
      const ph = phase[p];
      drawn[o] = a[o] * sxA * u + b[o] * sxB * t + ox + Math.sin(time * 0.6 + ph) * amp;
      drawn[o + 1] = a[o + 1] * syA * u + b[o + 1] * syB * t + oy + Math.cos(time * 0.5 + ph * 1.7) * amp;
      drawn[o + 2] = a[o + 2] * sxA * u + b[o + 2] * sxB * t + oz + Math.sin(time * 0.4 + ph * 2.3) * amp;
    }
    geometry.attributes.position.needsUpdate = true;

    // mark blob tracks the anchor box live (the lockup moves under scroll);
    // dots are proportionally bigger + fully opaque so the mark reads solid
    if (markEl) {
      const r = markEl.getBoundingClientRect();
      // hero-only tweaks: at full size the blob's footprint is a bit
      // bigger and sits slightly lower (dot size still scales with it,
      // so density matches the docked header state); fades out as the
      // lockup docks into the header (same curve as main.js placeLockup)
      const hero = 1 - smoothstep(Math.min(1, Math.max(0, scrollY / (anchors[1] * 0.55))));
      if (window.__DBG && window.__DBG-- > 0) console.log("DBG blob", JSON.stringify({ scrollY, hero, anchors1: anchors[1], rH: r.height, rTop: r.top, rLeft: r.left, visW, visH, M, offH: markEl.offsetHeight }));
      const mx = ((r.left + r.width / 2) / innerWidth - 0.5) * visW;
      // sampled logo-blob image spans ~0.95 unit-box units
      const ms = (((r.height / innerHeight) * visH) / 0.95) * (1 + hero * 0.12);
      const my = (0.5 - (r.top + r.height / 2) / innerHeight) * visH - hero * ms * 0.06;
      // floor in world units so dots stay visible even when the anchor is
      // small (mobile h1 clamps much smaller than desktop, e.g. 3.5rem vs
      // 9rem) — otherwise dots rasterize under a couple px and alphaTest
      // discards nearly all of them, making the whole mark disappear
      const minDotPx = 3.0;
      const minSize = (minDotPx * visH) / innerHeight;
      // hero-only size boost, layered on top of the same "hero" blend used
      // for ms/my above — the docked header (hero=0) is unaffected, so
      // tuning this can't regress that state; it exists because the base
      // multiplier is tuned for the docked size and is too small at hero
      // scale to clear minSize on its own
      markMaterial.size = Math.max(ms * (coarse ? 0.0248 : 0.0195) * (1 + hero * 1.0), minSize);
      // M is fixed, but the docked header anchor is much smaller in area
      // than the hero one — same dot count packed into far less area would
      // overlap into a solid disc despite the size floor above. Scale how
      // many points are DRAWN (not their positions) with anchor area, via
      // offsetHeight (layout size, unaffected by the lockup's CSS scale
      // transform) as the stable "full size" reference, so dot density
      // reads the same at any dock progress.
      const naturalH = markEl.offsetHeight;
      const areaRatio = naturalH > 0 ? Math.min(1, (r.height / naturalH) ** 2) : 1;
      markGeometry.setDrawRange(0, Math.max(580, Math.round(M * areaRatio)));
      const mAmp = reduceMotion ? 0 : ms * 0.008;
      for (let p = 0; p < M; p++) {
        const o = p * 3;
        const ph = phase[p];
        markDrawn[o] = markSrc[o] * ms + mx + Math.sin(time * 0.6 + ph) * mAmp;
        markDrawn[o + 1] = markSrc[o + 1] * ms + my + Math.cos(time * 0.5 + ph * 1.7) * mAmp;
        markDrawn[o + 2] = markSrc[o + 2] * ms + Math.sin(time * 0.4 + ph * 2.3) * mAmp;
      }
      markGeometry.attributes.position.needsUpdate = true;
    }

    if (!reduceMotion) points.rotation.y = Math.sin(time * 0.12) * 0.1;
    renderer.render(scene, camera);
    markRenderer.render(markScene, camera);
    raf = requestAnimationFrame(frame);
  }

  let raf = requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  });

  return {
    setTarget(index, pts) {
      targets[index] = pts;
    },
    setPreFrame(fn) {
      preFrame = fn;
    },
    shapeBottomPx,
  };
}
