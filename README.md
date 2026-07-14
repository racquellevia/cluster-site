# Cluster — one-pager

One-page site with a scroll-morphing point cloud (three.js) and anime.js text entrances. Black points on white, set in ZT Nature.

```bash
npm install
npm run dev      # local dev at http://localhost:5173
npm run build    # static output in dist/
```

## Adding your copy

Search `index.html` for `<!-- TODO` — every placeholder is marked.

## Adding your shape images

Each section's point cloud shape comes from an image: dark pixels become points.

1. Drop a `.jpg`, `.png`, or `.svg` into `public/shapes/` (dark shape on white/transparent works best).
2. On that section in `index.html`, set `data-shape-src="shapes/your-file.svg"`.

The `data-shape` attribute (`scatter | sphere | torus | grid | spiral`) is the procedural fallback used until an image is provided (or if it fails to load).
