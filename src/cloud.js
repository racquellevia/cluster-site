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
  Vector3,
  Clock,
} from "three";

const TAU = Math.PI * 2;
const FOV = 40;
const CAM_DIST = 10;

// dot color drifts between pink and orange, pushed away from the mid-grey
// they average to so 85%-opacity blending against the white background
// doesn't read as washed out
function saturate([r, g, b], amt) {
  const grey = (r + g + b) / 3;
  return [r, g, b].map((c) => Math.min(1, Math.max(0, grey + (c - grey) * amt)));
}
const PINK = saturate([0xbc / 255, 0x4a / 255, 0x72 / 255], 1.6);
const ORANGE = saturate([0xde / 255, 0x68 / 255, 0x26 / 255], 1.6);
const rgba = ([r, g, b], a) => `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${a})`;

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

const HULL_ANGLES = 90; // vertices in each shape's glow outline (4° resolution)
// glow fade steepness: 1 at rest (t=0 or 1), 0 mid-transition (t=0.5), raised
// to a power so it only appears once the dots have essentially finished
// settling into shape, instead of arriving alongside (or ahead of) them
const SETTLE_POWER = 10;

function fillGaps(out, r, numAngles, filled) {
  for (let k = 0; k < numAngles; k++) {
    if (filled(r[k])) continue;
    for (let d = 1; d < numAngles; d++) {
      const lo = (k - d + numAngles) % numAngles;
      if (filled(r[lo])) { out[k * 3] = out[lo * 3]; out[k * 3 + 1] = out[lo * 3 + 1]; break; }
      const hi = (k + d) % numAngles;
      if (filled(r[hi])) { out[k * 3] = out[hi * 3]; out[k * 3 + 1] = out[hi * 3 + 1]; break; }
    }
  }
}

// silhouette outline of a shape's own points (unit-box coords, same array
// format as targets[]): bucket points by angle from centroid and keep the
// farthest one per bucket (and the nearest, to trace an inner hole if the
// shape has one — e.g. the donut/torus). Every shape's outline gets the
// same vertex count in the same angular order, so any two can be blended
// vertex-for-vertex — and since the points backing image sections (star.png,
// chevrons.png, ...) are themselves sampled from that image's dark pixels
// (see sample.js), this traces the actual artwork, concave notches and
// holes included, not just a convex approximation.
function polarHull(pts, numAngles) {
  const n = pts.length / 3;
  let cx = 0, cy = 0;
  for (let p = 0; p < n; p++) { cx += pts[p * 3]; cy += pts[p * 3 + 1]; }
  cx /= n; cy /= n;
  const outer = new Float32Array(numAngles * 3);
  const inner = new Float32Array(numAngles * 3);
  const maxR = new Float32Array(numAngles).fill(-1);
  const minR = new Float32Array(numAngles).fill(-1);
  for (let p = 0; p < n; p++) {
    const x = pts[p * 3], y = pts[p * 3 + 1];
    const dx = x - cx, dy = y - cy;
    let a = Math.atan2(dy, dx);
    if (a < 0) a += TAU;
    const k = Math.min(numAngles - 1, (a / TAU) * numAngles | 0);
    const r = dx * dx + dy * dy;
    if (r > maxR[k]) { maxR[k] = r; outer[k * 3] = x; outer[k * 3 + 1] = y; }
    if (minR[k] < 0 || r < minR[k]) { minR[k] = r; inner[k * 3] = x; inner[k * 3 + 1] = y; }
  }
  // buckets with no point (gaps in a sparse/thin shape) fall back to their
  // nearest filled neighbor
  fillGaps(outer, maxR, numAngles, (r) => r >= 0);
  fillGaps(inner, minR, numAngles, (r) => r >= 0);
  // a hole exists if the nearest ink in most directions is still a good
  // distance out from center (a ring), rather than close to it (a disk)
  let holeVotes = 0;
  for (let k = 0; k < numAngles; k++) {
    if (maxR[k] > 0 && minR[k] / maxR[k] > 0.25) holeVotes++;
  }
  return { outer, inner: holeVotes > numAngles * 0.6 ? inner : null };
}

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
    opacity: 1,
    alphaTest: 0.4,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  // positions are rewritten every frame (scroll-driven morph/mark tracking);
  // three's frustum culling caches a boundingSphere computed once, lazily,
  // from whatever positions exist on the first render, then never
  // recomputes it — so a moving cloud can drift outside that stale sphere
  // and get silently culled (seen concretely: the mark blob vanishing after
  // a live window resize shifts its anchor's world position). Disable
  // culling instead of chasing computeBoundingSphere() every frame.
  points.frustumCulled = false;
  scene.add(points);

  // camera never moves after this — project() below needs matrixWorldInverse,
  // which only recomputes on updateMatrixWorld()
  camera.updateMatrixWorld();

  // pink/orange solid shapes behind the cloud, outlining its current
  // silhouette; sit in their own layer (z-index between #cloud and the page
  // background, see style.css) so the black dots draw on top of them.
  // Two representations, chosen per-section by whether it has a source
  // image (see setGlowImage/setGlowShape below): a masked div showing the
  // actual asset for sections that have one, an SVG path hull-traced from
  // the point cloud for the (procedural-only) sections that don't.
  const glowSvg = document.querySelector("#shape-glow");
  const pinkPoly = document.querySelector("#glow-pink");
  const orangePoly = document.querySelector("#glow-orange");
  const pinkImg = document.querySelector("#glow-pink-img");
  const orangeImg = document.querySelector("#glow-orange-img");
  // same pink/orange pair, but a plain circle behind the persistent logo
  // blob (see the markEl block below) instead of a per-section shape
  const pinkMark = document.querySelector("#glow-pink-mark");
  const orangeMark = document.querySelector("#glow-orange-mark");
  if (pinkPoly) pinkPoly.setAttribute("fill", rgba(PINK, 0.15));
  if (orangePoly) orangePoly.setAttribute("fill", rgba(ORANGE, 0.15));
  if (pinkImg) pinkImg.style.backgroundColor = rgba(PINK, 0.15);
  if (orangeImg) orangeImg.style.backgroundColor = rgba(ORANGE, 0.15);
  if (pinkMark) pinkMark.style.backgroundColor = rgba(PINK, 0.15);
  if (orangeMark) orangeMark.style.backgroundColor = rgba(ORANGE, 0.15);
  const projected = new Vector3();

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
  const markPoints = new Points(markGeometry, markMaterial);
  markPoints.frustumCulled = false; // see the `points.frustumCulled` comment above
  markScene.add(markPoints);

  const targets = sectionEls.map(() => initial);
  const hulls = targets.map((pts) => polarHull(pts, HULL_ANGLES));
  // per-section glow asset, when one exists (see setGlowImage): the source
  // image url plus its unit-box bounding box, used to size/place the mask
  const glowImages = sectionEls.map(() => null);
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
    if (glowSvg) glowSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
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
    hulls[0] = polarHull(targets[0], HULL_ANGLES);
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

    // outline the cloud's current shape and fill it with the pink/orange
    // glow shapes, each nudged a bit off-center so they read as two
    // overlapping layers instead of sitting perfectly stacked — same
    // vertical orientation as the point cloud, just shifted apart. Unlike
    // the dots, these don't morph between shapes: they show whichever shape
    // is nearest and fade out while scrolling between shapes (t away from
    // 0 or 1), back in once the cloud settles into the next one.
    if (pinkPoly || orangePoly || pinkImg || orangeImg) {
      const nearest = t < 0.5 ? i : j;
      const [nx, ny, nsx, nsy, , nz] = transform(nearest);
      const wobbleX = reduceMotion ? 0 : Math.sin(time * 0.15) * 6;
      const wobbleY = reduceMotion ? 0 : Math.cos(time * 0.13) * 6;
      const img = glowImages[nearest];

      if (img) {
        // real shape asset: mask a colored div to its exact silhouette,
        // sized/positioned to its projected on-screen bounding box
        if (pinkPoly) pinkPoly.setAttribute("d", "");
        if (orangePoly) orangePoly.setAttribute("d", "");
        const corners = [
          [img.minX, img.minY], [img.maxX, img.minY],
          [img.minX, img.maxY], [img.maxX, img.maxY],
        ];
        let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity, onScreen = 0;
        for (const [ux, uy] of corners) {
          projected.set(ux * nsx + nx, uy * nsy + ny, nz).project(camera);
          const x = (projected.x * 0.5 + 0.5) * innerWidth;
          const y = (1 - (projected.y * 0.5 + 0.5)) * innerHeight;
          if (x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight) onScreen++;
          if (x < minPx) minPx = x;
          if (x > maxPx) maxPx = x;
          if (y < minPy) minPy = y;
          if (y > maxPy) maxPy = y;
        }
        const settled = onScreen === 0 ? 0 : Math.abs(2 * t - 1) ** SETTLE_POWER;
        // per-asset size fudge (see data-glow-scale in index.html): the glow
        // svgs' own bounding boxes don't always match their dot-cloud raster's
        // proportions, so scale around the same center rather than the corner
        const scale = img.scale || 1;
        const offsetY = img.offsetY || 0;
        const cx = (minPx + maxPx) / 2 + (img.offsetX || 0), cy = (minPy + maxPy) / 2 + offsetY;
        const w = (maxPx - minPx) * scale, h = (maxPy - minPy) * scale;
        if (pinkImg) {
          pinkImg.style.maskImage = pinkImg.style.webkitMaskImage = `url(${img.url})`;
          pinkImg.style.left = `${cx - w / 2 - 14 - wobbleX}px`;
          pinkImg.style.top = `${cy - h / 2 - 3 + (img.pinkOffsetY || 0) - wobbleY}px`;
          pinkImg.style.width = `${w}px`;
          pinkImg.style.height = `${h}px`;
          pinkImg.style.opacity = settled;
        }
        if (orangeImg) {
          orangeImg.style.maskImage = orangeImg.style.webkitMaskImage = `url(${img.url})`;
          orangeImg.style.left = `${cx - w / 2 + 14 + (img.orangeOffsetX || 0) + wobbleX}px`;
          orangeImg.style.top = `${cy - h / 2 + 8 + wobbleY}px`;
          orangeImg.style.width = `${w}px`;
          orangeImg.style.height = `${h}px`;
          orangeImg.style.opacity = settled;
        }
      } else {
        // no source asset (procedural-only shape): fall back to a hull
        // traced from the point cloud's own dots
        if (pinkImg) pinkImg.style.opacity = 0;
        if (orangeImg) orangeImg.style.opacity = 0;
        const hull = hulls[nearest];
        const projectRing = (ring) => {
          const pts = [];
          let onScreen = 0;
          for (let q = 0; q < HULL_ANGLES; q++) {
            const o = q * 3;
            const hx = ring[o] * nsx + nx;
            const hy = ring[o + 1] * nsy + ny;
            const hz = ring[o + 2] * nsx + nz;
            projected.set(hx, hy, hz).project(camera);
            const x = (projected.x * 0.5 + 0.5) * innerWidth;
            const y = (1 - (projected.y * 0.5 + 0.5)) * innerHeight;
            if (x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight) onScreen++;
            pts.push([x, y]);
          }
          return { pts, onScreen };
        };
        // shapes with a hole (e.g. the procedural torus) get a second,
        // inner ring — fill-rule="evenodd" on the <path> cuts it out
        const outerRing = projectRing(hull.outer);
        const innerRing = hull.inner && projectRing(hull.inner);
        // also hides while mostly off-screen (e.g. the hero's offscreen ring)
        const settled = outerRing.onScreen < HULL_ANGLES * 0.3 ? 0 : Math.abs(2 * t - 1) ** SETTLE_POWER;
        const ringPath = (pts, dx, dy) =>
          "M" + pts.map(([x, y]) => `${(x + dx).toFixed(1)},${(y + dy).toFixed(1)}`).join("L") + "Z";
        const toPath = (dx, dy) =>
          ringPath(outerRing.pts, dx, dy) + (innerRing ? " " + ringPath(innerRing.pts, dx, dy) : "");
        if (pinkPoly) {
          pinkPoly.setAttribute("d", toPath(-14 - wobbleX, -3 - wobbleY));
          pinkPoly.style.opacity = settled;
        }
        if (orangePoly) {
          orangePoly.setAttribute("d", toPath(14 + wobbleX, 8 + wobbleY));
          orangePoly.style.opacity = settled;
        }
      }
    }

    // mark blob tracks the anchor box live (the lockup moves under scroll);
    // dots are proportionally bigger + fully opaque so the mark reads solid
    if (markEl) {
      const r = markEl.getBoundingClientRect();
      // hero-only tweaks: at full size the blob's footprint is a bit
      // bigger and sits slightly lower (dot size still scales with it,
      // so density matches the docked header state); fades out as the
      // lockup docks into the header (same curve as main.js placeLockup)
      const hero = 1 - smoothstep(Math.min(1, Math.max(0, scrollY / (anchors[1] * 0.55))));
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

      // circle glow behind the blob: same 0.15-opacity pink/orange pair and
      // offset/wobble as the per-section shapes, just always-on (no settle
      // fade) since the mark itself never fades in/out, only docks smaller.
      // Offset/wobble scale with the anchor's own size (fractions tuned to
      // match the old fixed ±14/±8px look at hero scale, r.width ~104px)
      // instead of fixed px, so they stay aligned behind the dots as the
      // anchor shrinks into the header instead of drifting off to the sides.
      if (pinkMark || orangeMark) {
        const wobbleX = reduceMotion ? 0 : Math.sin(time * 0.15) * r.width * 0.058;
        const wobbleY = reduceMotion ? 0 : Math.cos(time * 0.13) * r.width * 0.058;
        const cScale = 0.84;
        const cw = r.width * cScale, ch = r.height * cScale;
        const ccx = r.left + r.width / 2, ccy = r.top + r.height / 2;
        const offX = r.width * 0.135;
        if (pinkMark) {
          pinkMark.style.left = `${ccx - cw / 2 - offX - wobbleX}px`;
          pinkMark.style.top = `${ccy - ch / 2 - r.height * 0.029 - wobbleY}px`;
          pinkMark.style.width = `${cw}px`;
          pinkMark.style.height = `${ch}px`;
        }
        if (orangeMark) {
          orangeMark.style.left = `${ccx - cw / 2 + offX + wobbleX}px`;
          orangeMark.style.top = `${ccy - ch / 2 + r.height * 0.077 + wobbleY}px`;
          orangeMark.style.width = `${cw}px`;
          orangeMark.style.height = `${ch}px`;
        }
      }
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
      hulls[index] = polarHull(pts, HULL_ANGLES);
    },
    // registers a section's real shape image/svg as its glow layer (drawn
    // via CSS mask, see the frame loop) instead of the point-cloud hull —
    // img: { url, minX, maxX, minY, maxY } in unit-box coords, or null to
    // fall back to the hull traced from this section's dots
    setGlowImage(index, img) {
      glowImages[index] = img;
    },
    setPreFrame(fn) {
      preFrame = fn;
    },
    shapeBottomPx,
  };
}
