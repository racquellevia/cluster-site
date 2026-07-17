import { defineConfig } from "vite";
import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import { join, resolve, extname } from "node:path";

const MIME = {
  woff2: "font/woff2",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

async function dataUri(file) {
  const ext = extname(file).slice(1).toLowerCase();
  const buf = await readFile(file);
  return `data:${MIME[ext] || "application/octet-stream"};base64,${buf.toString("base64")}`;
}

// After Vite writes dist/, fold the single JS + CSS chunks, the fonts, and the
// runtime-loaded shape images all into dist/index.html so the whole site is one
// self-contained file you can email and open with a double-click.
function inlineEverything() {
  return {
    name: "inline-everything",
    enforce: "post",
    async writeBundle(options) {
      const dir = options.dir;
      const htmlPath = join(dir, "index.html");
      let html = await readFile(htmlPath, "utf8");

      // Build shapes/<file> -> data URI map, consumed at runtime via window.__ASSETS__.
      const shapesDir = resolve("public/shapes");
      const assets = {};
      for (const file of await readdir(shapesDir)) {
        assets[`shapes/${file}`] = await dataUri(join(shapesDir, file));
      }

      // Inline the favicon too — it's a plain public/ file Vite copies into
      // dist/, but the cleanup below deletes everything except index.html.
      const faviconUri = await dataUri(resolve("public/favicon.png"));
      html = html.replace('href="./favicon.png"', `href="${faviconUri}"`);

      // Inline the CSS chunk, with its @font-face url()s swapped for data URIs.
      const files = await readdir(dir);
      const cssFile = files.find((f) => f.endsWith(".css"));
      if (cssFile) {
        let css = await readFile(join(dir, cssFile), "utf8");
        const fontsDir = resolve("public/fonts");
        for (const font of await readdir(fontsDir)) {
          const uri = await dataUri(join(fontsDir, font));
          css = css.replace(
            new RegExp(`url\\(["']?[^"')]*${font}["']?\\)`, "g"),
            () => `url("${uri}")`
          );
        }
        html = html.replace(
          new RegExp(`<link[^>]+href="[^"]*${cssFile}"[^>]*>`),
          () => `<style>${css}</style>`
        );
      }

      // Inline the JS chunk (single, no remaining imports) as an inline module.
      const jsFile = files.find((f) => f.endsWith(".js"));
      if (jsFile) {
        const js = (await readFile(join(dir, jsFile), "utf8")).replace(
          /<\/script/gi,
          "<\\/script"
        );
        html = html.replace(
          new RegExp(`<script[^>]+src="[^"]*${jsFile}"[^>]*></script>`),
          () => `<script type="module">${js}</script>`
        );
      }

      // Drop font preloads (their files are gone) and expose the shapes map
      // before the module runs.
      html = html.replace(/\s*<link[^>]+rel="preload"[^>]*>/g, "");
      html = html.replace(
        "</head>",
        `<script>window.__ASSETS__=${JSON.stringify(assets)};</script></head>`
      );

      await writeFile(htmlPath, html);

      // Leave dist/ holding just the one file.
      for (const f of files) if (f !== "index.html") await rm(join(dir, f), { recursive: true, force: true });
      await rm(join(dir, "fonts"), { recursive: true, force: true });
      await rm(join(dir, "shapes"), { recursive: true, force: true });
      await rm(join(dir, "assets"), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [inlineEverything()],
  build: {
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 100_000_000, // inline every Vite-processed asset
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "app.js",
        assetFileNames: "app[extname]",
      },
    },
  },
});
