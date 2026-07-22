// Turns a section's shape spec into n points in a unit box:
// x,y in [-0.5, 0.5] (aspect preserved), z a thin slab for depth.

const Z_DEPTH = 0.12;

function positions(n, fill) {
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) fill(pts, i * 3);
  return pts;
}

const TAU = Math.PI * 2;

const PROCEDURAL = {
  scatter: (n) =>
    positions(n, (p, o) => {
      // gaussian-ish blob via averaged randoms
      p[o] = (Math.random() + Math.random() + Math.random() - 1.5) * 0.33;
      p[o + 1] = (Math.random() + Math.random() + Math.random() - 1.5) * 0.33;
      p[o + 2] = (Math.random() - 0.5) * 0.5;
    }),
  sphere: (n) =>
    positions(n, (p, o) => {
      const u = Math.random() * TAU;
      const v = Math.acos(2 * Math.random() - 1);
      const r = 0.45 * Math.cbrt(0.7 + 0.3 * Math.random());
      p[o] = r * Math.sin(v) * Math.cos(u);
      p[o + 1] = r * Math.cos(v);
      p[o + 2] = r * Math.sin(v) * Math.sin(u);
    }),
  torus: (n) =>
    positions(n, (p, o) => {
      const u = Math.random() * TAU;
      const v = Math.random() * TAU;
      const R = 0.34;
      const r = 0.11 * Math.sqrt(Math.random());
      p[o] = (R + r * Math.cos(v)) * Math.cos(u);
      p[o + 1] = (R + r * Math.cos(v)) * Math.sin(u);
      p[o + 2] = r * Math.sin(v);
    }),
  grid: (n) =>
    positions(n, (p, o) => {
      const side = Math.round(Math.sqrt(n));
      const i = o / 3;
      p[o] = ((i % side) / (side - 1) - 0.5) * 0.9 + (Math.random() - 0.5) * 0.008;
      p[o + 1] = (Math.floor(i / side) / (side - 1) - 0.5) * 0.9 + (Math.random() - 0.5) * 0.008;
      p[o + 2] = (Math.random() - 0.5) * 0.04;
    }),
  spiral: (n) =>
    positions(n, (p, o) => {
      const t = Math.random();
      const a = t * TAU * 3;
      const r = 0.06 + t * 0.4;
      const jitter = 0.03;
      p[o] = r * Math.cos(a) + (Math.random() - 0.5) * jitter;
      p[o + 1] = r * Math.sin(a) + (Math.random() - 0.5) * jitter;
      p[o + 2] = (Math.random() - 0.5) * Z_DEPTH;
    }),
  wave: (n) =>
    positions(n, (p, o) => {
      // rippled band, like a sound wave
      const x = Math.random() - 0.5;
      p[o] = x * 0.95;
      p[o + 1] = Math.sin(x * TAU * 1.5) * 0.22 + (Math.random() - 0.5) * 0.22;
      p[o + 2] = (Math.random() - 0.5) * Z_DEPTH;
    }),
  clusters: (n) => {
    // handful of small blobs — groups breaking out around the room
    const C = [
      [-0.3, 0.24],
      [0.3, 0.3],
      [0.33, -0.24],
      [-0.31, -0.28],
      [0.0, 0.0],
    ];
    return positions(n, (p, o) => {
      const [cx, cy] = C[(Math.random() * C.length) | 0];
      p[o] = cx + (Math.random() + Math.random() - 1) * 0.15;
      p[o + 1] = cy + (Math.random() + Math.random() - 1) * 0.15;
      p[o + 2] = (Math.random() - 0.5) * Z_DEPTH;
    });
  },
  helix: (n) =>
    positions(n, (p, o) => {
      // two vertical strands winding around each other
      const t = Math.random();
      const a = t * TAU * 1.5 + (Math.random() < 0.5 ? 0 : Math.PI);
      p[o] = Math.cos(a) * 0.24 + (Math.random() - 0.5) * 0.07;
      p[o + 1] = (t - 0.5) * 0.95;
      p[o + 2] = Math.sin(a) * 0.24 + (Math.random() - 0.5) * 0.07;
    }),
  cone: (n) =>
    positions(n, (p, o) => {
      // solid cone: apex at top, disc cross-sections widen toward the base
      const H = 0.6;
      const R = 0.28;
      const t = Math.random(); // 0 at apex, 1 at base
      const radiusHere = R * t;
      const rr = Math.sqrt(Math.random()) * radiusHere; // uniform fill of the disc
      const a = Math.random() * TAU;
      p[o] = rr * Math.cos(a);
      p[o + 1] = H / 2 - t * H;
      p[o + 2] = rr * Math.sin(a);
    }),
  flower: (n) =>
    positions(n, (p, o) => {
      // ring of rounded, overlapping lobes (a solid ball per lobe reads much
      // better as sparse points than a thin twisted ribbon)
      const lobes = 5;
      const i = Math.floor(Math.random() * lobes);
      const angle = (TAU * i) / lobes;
      const R = 0.24; // ring radius where lobe centers sit
      const cx = R * Math.cos(angle);
      const cy = R * Math.sin(angle);
      const u = Math.random() * TAU;
      const v = Math.acos(2 * Math.random() - 1);
      const r = 0.22 * Math.cbrt(0.7 + 0.3 * Math.random()); // lobe radius; overlaps neighbors
      p[o] = cx + r * Math.sin(v) * Math.cos(u);
      p[o + 1] = cy + r * Math.cos(v);
      p[o + 2] = r * Math.sin(v) * Math.sin(u);
    }),
};

// In the single-file build, images are inlined as data URIs under this map;
// in dev it's undefined and we fetch the URL as usual.
function resolveAssetUrl(src) {
  return (typeof window !== "undefined" && window.__ASSETS__?.[src]) || src;
}

// Loads an image and returns its "ink" (dark or opaque-on-transparent)
// pixel indices plus the sampled canvas size.
async function loadInk(src) {
  const resolved = resolveAssetUrl(src);
  const img = new Image();
  img.src = resolved;
  await img.decode();

  const MAX = 256;
  const scale = MAX / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const ink = [];
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    const lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    if (a > 96 && lum < 160) ink.push(i);
  }
  if (ink.length < 8) throw new Error(`no dark pixels found in ${src}`);
  return { ink, w, h };
}

// Samples n points from an image's ink pixels, jittered within each pixel
// so points don't land on a visible grid.
async function fromImage(src, n) {
  const { ink, w, h } = await loadInk(src);
  const unit = 1 / Math.max(w, h);
  return positions(n, (p, o) => {
    const px = ink[(Math.random() * ink.length) | 0];
    p[o] = ((px % w) + Math.random() - w / 2) * unit;
    p[o + 1] = -((Math.floor(px / w)) + Math.random() - h / 2) * unit;
    p[o + 2] = (Math.random() - 0.5) * Z_DEPTH;
  });
}

// A section's glow shape asset (see cloud.js): an alpha-mask silhouette of
// the image's ink pixels — white ink, fully transparent elsewhere — so it
// works as a CSS mask-image regardless of whether the source asset itself
// has any transparency (most of ours are dark ink on opaque white). Also
// returns the ink's unit-box bounding box, for sizing/positioning the div
// this masks — same coordinate space fromImage() samples the dots into.
export async function glowAsset(src) {
  const { ink, w, h } = await loadInk(src);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const out = ctx.createImageData(w, h);
  const unit = 1 / Math.max(w, h);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const px of ink) {
    out.data[px * 4] = out.data[px * 4 + 1] = out.data[px * 4 + 2] = out.data[px * 4 + 3] = 255;
    const x = (px % w) * unit - (w / 2) * unit;
    const y = -(Math.floor(px / w) * unit - (h / 2) * unit);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  ctx.putImageData(out, 0, 0);
  const blob = await canvas.convertToBlob();
  return { url: URL.createObjectURL(blob), minX, maxX, minY, maxY };
}

// spec: { src?: string, fallback: string }
export async function shapePoints(spec, n) {
  if (spec.src) {
    try {
      return await fromImage(spec.src, n);
    } catch (err) {
      console.warn(`shape image failed (${spec.src}), using "${spec.fallback}"`, err);
    }
  }
  return (PROCEDURAL[spec.fallback] || PROCEDURAL.scatter)(n);
}
