#!/usr/bin/env node
// Classify a URL as static or SPA and report framework/animation hints.
// Usage: node detect-site-type.mjs <url>

const url = process.argv[2];
if (!url) {
  console.error("Usage: node detect-site-type.mjs <url>");
  process.exit(1);
}

function detectFramework(html) {
  const checks = [
    { name: "Webflow", rx: /data-wf-domain|data-wf-page|data-wf-site|website-files\.com/ },
    { name: "WordPress", rx: /wp-content\/|wp-includes\/|meta name="generator" content="WordPress/ },
    { name: "Squarespace", rx: /squarespace-cdn|class="sqs-/ },
    { name: "Shopify", rx: /cdn\.shopify\.com|Shopify\.theme/ },
    { name: "Framer", rx: /framer\.com|data-framer/ },
    { name: "Wix", rx: /static\.wixstatic|wix-public/ },
    { name: "Next.js", rx: /id="__next"|\/_next\// },
    { name: "Nuxt", rx: /id="__nuxt"|\/_nuxt\// },
    { name: "Remix", rx: /__remixContext/ },
    { name: "SvelteKit", rx: /__sveltekit/ },
    { name: "Gatsby", rx: /___gatsby|gatsby-image/ },
    { name: "React (bare)", rx: /id="root"[^>]*>\s*<\/div>/ },
    { name: "Vue (bare)", rx: /id="app"[^>]*>\s*<\/div>/ },
  ];
  return checks.filter((c) => c.rx.test(html)).map((c) => c.name);
}

function detectAnimations(html) {
  const checks = [
    { name: "GSAP", rx: /gsap\.|TweenMax|TweenLite|ScrollTrigger/ },
    { name: "Webflow IX2", rx: /data-w-id|Webflow.require\(['"]ix2/ },
    { name: "AOS", rx: /data-aos|aos\.js/ },
    { name: "Framer Motion", rx: /framer-motion/ },
    { name: "Lenis", rx: /lenis|class="lenis/ },
    { name: "Locomotive", rx: /locomotive-scroll/ },
  ];
  return checks.filter((c) => c.rx.test(html)).map((c) => c.name);
}

function isSPAShell(html) {
  // Empty root div → SPA that renders client-side
  const spaMarkers = [
    /<div\s+id="root"[^>]*>\s*<\/div>/,
    /<div\s+id="app"[^>]*>\s*<\/div>/,
    /<div\s+id="__next"[^>]*>\s*<\/div>/,
  ];
  const hasEmptyShell = spaMarkers.some((rx) => rx.test(html));
  const bodyTextLength = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] || "")
    .replace(/<[^>]+>/g, "")
    .trim().length;
  return hasEmptyShell || bodyTextLength < 200;
}

function detectAssetHints(html) {
  return {
    avif: /\.avif/.test(html),
    webp: /\.webp/.test(html),
    srcset: /srcset=/.test(html),
    googleFonts: /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html),
    localFonts: /@font-face/.test(html),
    cdns: [...new Set((html.match(/https?:\/\/[^"'\s]*cdn[^"'\s]*/gi) || []).map((u) => new URL(u).host))].slice(0, 5),
  };
}

function countInternalLinks(html, baseUrl) {
  const base = new URL(baseUrl);
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const internal = new Set();
  for (const href of links) {
    try {
      const u = new URL(href, base);
      if (u.host === base.host && u.pathname !== base.pathname) {
        internal.add(u.pathname);
      }
    } catch {}
  }
  return internal.size;
}

try {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 clone-hybrid/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const frameworks = detectFramework(html);
  const animations = detectAnimations(html);
  const isSPA = isSPAShell(html);
  const assetHints = detectAssetHints(html);
  const linkCount = countInternalLinks(html, url);

  const report = {
    url,
    type: isSPA ? "spa" : "static",
    htmlSize: html.length,
    frameworks,
    animations,
    assetHints,
    linkCount,
    recommendation: isSPA
      ? "use Playwright capture — goclone would get an empty shell"
      : "use goclone for fast raw capture + Playwright for interaction sweep",
  };

  console.log(JSON.stringify(report, null, 2));
} catch (err) {
  console.error(`Detection failed: ${err.message}`);
  process.exit(1);
}
