#!/usr/bin/env node
// Parse all CSS files in a directory, extract url() / @import / @font-face references,
// download missing assets, and rewrite CSS URLs to local relative paths.
// Usage: node extract-assets.mjs <project-dir> [--base <source-url>]

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , projectDir, ...rest] = process.argv;
if (!projectDir) {
  console.error("Usage: node extract-assets.mjs <project-dir> [--base <source-url>]");
  process.exit(1);
}
const baseUrl = rest[rest.indexOf("--base") + 1] || null;

const ROOT = path.resolve(projectDir);
const FONTS_DIR = path.join(ROOT, "fonts");
const IMGS_DIR = path.join(ROOT, "imgs");
await fs.mkdir(FONTS_DIR, { recursive: true });
await fs.mkdir(IMGS_DIR, { recursive: true });

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.isFile() && p.endsWith(".css")) files.push(p);
  }
  return files;
}

const URL_RX = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
const IMPORT_RX = /@import\s+(?:url\(\s*["']?|["'])([^"')]+)["']?\s*\)?/g;

function isRemote(u) {
  return /^https?:\/\//.test(u);
}

function isDataUri(u) {
  return u.startsWith("data:");
}

function extFor(u) {
  const ext = path.extname(new URL(u, "http://x").pathname).toLowerCase();
  return ext || ".bin";
}

function filenameFor(u) {
  const url = new URL(u, "http://x");
  return path.basename(url.pathname).replace(/%20/g, "-");
}

function classifyAsset(u) {
  const ext = extFor(u).toLowerCase();
  if ([".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext)) return "fonts";
  return "imgs";
}

async function download(url, outPath) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 clone-hybrid/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(outPath, buf);
    return { ok: true, size: buf.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function processCss(cssPath) {
  const cssDir = path.dirname(cssPath);
  let css = await fs.readFile(cssPath, "utf8");
  const replacements = [];

  const found = new Set();
  let m;
  URL_RX.lastIndex = 0;
  while ((m = URL_RX.exec(css))) {
    if (!isDataUri(m[1])) found.add(m[1]);
  }
  IMPORT_RX.lastIndex = 0;
  while ((m = IMPORT_RX.exec(css))) {
    if (!isDataUri(m[1])) found.add(m[1]);
  }

  for (const ref of found) {
    let absolute;
    if (isRemote(ref)) absolute = ref;
    else if (baseUrl) absolute = new URL(ref, baseUrl).toString();
    else continue; // relative refs without a base can't be resolved

    const cat = classifyAsset(absolute);
    const outDir = cat === "fonts" ? FONTS_DIR : IMGS_DIR;
    const fname = filenameFor(absolute);
    const outPath = path.join(outDir, fname);

    try {
      await fs.access(outPath);
      // Already downloaded
    } catch {
      const res = await download(absolute, outPath);
      if (res.ok) {
        console.log(`  ✓ ${fname} (${Math.round(res.size / 1024)}kb)`);
      } else {
        console.log(`  ✗ ${fname} — ${res.error}`);
        continue;
      }
    }

    const relativeToCss = path
      .relative(cssDir, outPath)
      .replace(/\\/g, "/");
    replacements.push({ from: ref, to: relativeToCss });
  }

  for (const { from, to } of replacements) {
    css = css.split(from).join(to);
  }
  await fs.writeFile(cssPath, css);
}

const cssFiles = await walk(ROOT);
console.log(`Processing ${cssFiles.length} CSS files…\n`);
for (const f of cssFiles) {
  console.log(`→ ${path.relative(ROOT, f)}`);
  await processCss(f);
}
console.log("\nDone.");
