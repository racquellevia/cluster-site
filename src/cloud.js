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
  let anchors = [];
  // world-space x per section: cloud centered in the negative space between
  // the copy column and the far browser edge (0 on narrow screens / hero)
  let sideX = sectionEls.map(() => 0);

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
    const wide = camera.aspect > 1.05;
    sideX = sectionEls.map((el, i) => {
      if (i === 0 || !wide) return 0;
      const r = el.querySelector(".copy").getBoundingClientRect();
      const onRight = r.left + r.width / 2 > w / 2;
      const cx = onRight ? r.left / 2 : (r.right + w) / 2; // gap midpoint, px
      return (cx / w - 0.5) * visW;
    });
    targets[0] = offscreenRing();
  }
  resize();
  addEventListener("resize", resize);
  document.fonts.ready.then(resize); // section offsets shift when ZT Nature loads

  // per-section size multiplier via data-shape-scale on the section
  const shapeScale = sectionEls.map((el) => parseFloat(el.dataset.shapeScale) || 1);

  // world-space [x, y, scale, dotSize] of the morph cloud for section k
  function transform(k) {
    const s = scale * shapeScale[k];
    return [sideX[k], 0, s, s * (coarse ? 0.016 : 0.011)];
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

  function frame() {
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

    const [xA, yA, sA, dA] = transform(i);
    const [xB, yB, sB, dB] = transform(j);
    const ox = xA * u + xB * t;
    const oy = yA * u + yB * t;
    const sNow = sA * u + sB * t;

    material.size = dA * u + dB * t;

    const amp = reduceMotion ? 0 : sNow * 0.008;
    for (let p = 0; p < N; p++) {
      const o = p * 3;
      const ph = phase[p];
      drawn[o] = a[o] * sA * u + b[o] * sB * t + ox + Math.sin(time * 0.6 + ph) * amp;
      drawn[o + 1] = a[o + 1] * sA * u + b[o + 1] * sB * t + oy + Math.cos(time * 0.5 + ph * 1.7) * amp;
      drawn[o + 2] = a[o + 2] * sA * u + b[o + 2] * sB * t + Math.sin(time * 0.4 + ph * 2.3) * amp;
    }
    geometry.attributes.position.needsUpdate = true;

    // mark blob tracks the anchor box live (the lockup moves under scroll);
    // dots are proportionally bigger + fully opaque so the mark reads solid
    if (markEl) {
      const r = markEl.getBoundingClientRect();
      // hero-only tweaks: at full size the blob is a bit bigger, denser
      // (fatter dots), and sits slightly lower; fades out as the lockup
      // docks into the header (same scroll curve as main.js placeLockup)
      const hero = 1 - smoothstep(Math.min(1, Math.max(0, scrollY / (anchors[1] * 0.55))));
      const mx = ((r.left + r.width / 2) / innerWidth - 0.5) * visW;
      // sampled logo-blob image spans ~0.95 unit-box units
      const ms = (((r.height / innerHeight) * visH) / 0.95) * (1 + hero * 0.12);
      const my = (0.5 - (r.top + r.height / 2) / innerHeight) * visH - hero * ms * 0.06;
      markMaterial.size = ms * (coarse ? 0.035 : 0.027) * (1 + hero * 0.3);
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
  };
}
