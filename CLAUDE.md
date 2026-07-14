# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

One-page static site for "Cluster" (an Eyelight program): a scroll-morphing three.js point cloud behind anime.js text entrances. Vanilla JS + Vite, no framework, no tests.

## Commands

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # static output in dist/
npm run preview  # serve dist/
```

## Architecture

One always-visible fixed canvas renders two `THREE.Points` clouds: a small blob pinned to the hero lockup's `#cloud-anchor` (the lockup shrinks into a fixed upper-left header on scroll, see `main.js`), and a main cloud that scrolling morphs between per-section shapes — starting from a ring of dots outside the viewport at the hero, so the first shape flies in from offscreen. The flow:

1. `index.html` — each `<section class="panel">` declares its shape via `data-shape` (procedural fallback: `scatter | sphere | torus | grid | spiral | wave | clusters | helix`) and optional `data-shape-src` (image in `public/shapes/`; dark pixels become points). Placeholder copy is marked with `<!-- TODO` comments.
2. `src/sample.js` — `shapePoints(spec, n)` resolves a spec into a `Float32Array` of n points in a unit box (x,y in [-0.5, 0.5], thin z slab). Image sampling picks dark/opaque pixels; on failure it falls back to the procedural shape.
3. `src/main.js` — renders immediately with the hero's procedural shape, then swaps each section's real shape in via `cloud.setTarget(i, pts)` as images resolve. Point count: 6000 (3000 on coarse pointers).
4. `src/cloud.js` — `startCloud()` owns the render loop. Scroll position maps to a fractional shape index (section `offsetTop` anchors); the position buffer lerps between adjacent targets with smoothstep + exponential smoothing. The cloud shifts horizontally opposite each section's copy (copy alternates sides via CSS `nth-of-type`). Target 0 (the offscreen ring) is owned by cloud.js, not main.js; the mark blob re-reads the anchor's bounding rect every frame so it tracks the header shrink.
5. `src/text.js` — anime.js scroll-triggered fade/rise for each section's copy.

`prefers-reduced-motion` is respected throughout (snap instead of morph, no drift/rotation, minimal text animation) — keep that when touching animation code.

## Fonts

ZT Nature, self-hosted woff2 in `public/fonts/` (only Light/Regular/SemiBold are used; full family source lives in `ZT_nature/`, which is not shipped).
