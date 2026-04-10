#!/usr/bin/env node
// Discover internal links for multi-page cloning.
// Usage: node crawl-links.mjs <url> [--max-depth N] [--max-pages N] [--same-origin]

import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const startUrl = args.find((a) => !a.startsWith("--"));
if (!startUrl) {
  console.error("Usage: node crawl-links.mjs <url> [--max-depth 3] [--max-pages 50] [--same-origin] [--out pages.json]");
  process.exit(1);
}
function flagValue(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = args[i + 1];
  if (!v || v.startsWith("--")) return fallback;
  return v;
}

const opts = {
  maxDepth: +flagValue("--max-depth", 3),
  maxPages: +flagValue("--max-pages", 50),
  sameOrigin: args.includes("--same-origin"),
  out: flagValue("--out", null),
};

const base = new URL(startUrl);
const visited = new Set();
const results = [];
const queue = [{ url: startUrl, depth: 0 }];

function extractLinks(html, pageUrl) {
  const links = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)].map((m) => m[1]);
  const out = new Set();
  for (const href of links) {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    try {
      const u = new URL(href, pageUrl);
      u.hash = "";
      if (opts.sameOrigin && u.host !== base.host) continue;
      if (!opts.sameOrigin && u.host !== base.host) continue; // same-origin by default for now
      out.add(u.toString());
    } catch {}
  }
  return [...out];
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 clone-hybrid-crawler/1.0" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

while (queue.length && results.length < opts.maxPages) {
  const { url, depth } = queue.shift();
  if (visited.has(url)) continue;
  visited.add(url);

  process.stderr.write(`[${results.length + 1}/${opts.maxPages}] depth=${depth} ${url}\n`);
  const html = await fetchPage(url);
  if (!html) continue;

  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  results.push({ url, depth, title, pathname: new URL(url).pathname });

  if (depth < opts.maxDepth) {
    for (const link of extractLinks(html, url)) {
      if (!visited.has(link)) queue.push({ url: link, depth: depth + 1 });
    }
  }
}

const output = JSON.stringify({ start: startUrl, count: results.length, pages: results }, null, 2);
if (opts.out) {
  writeFileSync(opts.out, output);
  process.stderr.write(`\nWrote ${results.length} pages to ${opts.out}\n`);
} else {
  console.log(output);
}
