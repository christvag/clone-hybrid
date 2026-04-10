# Framework Detection Guide

Quick lookup table for identifying the source framework of a site you're cloning.
Detection is automated in `scripts/detect-site-type.mjs` — this doc is for cases
where the script's classification is ambiguous or you need to manually verify.

## Signal table

| Framework | Strongest signals | File paths | Notes |
|---|---|---|---|
| **Webflow** | `data-wf-domain`, `data-wf-page`, `.w-*` classes, `webflow.schunk.*.js` | `cdn.prod.website-files.com/...` | Animation system = IX2 (`data-w-id` attributes) |
| **WordPress** | `wp-content/`, `wp-includes/`, `meta name="generator" content="WordPress"` | `/wp-content/themes/<theme>/` | Look at theme folder to identify the builder (Elementor, Divi, Oxygen) |
| **Squarespace** | `squarespace-cdn`, `.sqs-*` classes, `Y.Squarespace` global | `static1.squarespace.com/...` | Limited HTML control |
| **Shopify** | `cdn.shopify.com`, `Shopify.theme`, `/cdn/shop/...` | Liquid templates | Check for theme (Dawn, Debut, custom) |
| **Framer** | `data-framer-*`, `framer.com` meta, `framerusercontent.com` | CDN paths | Heavy animation → need Framer Motion reconstruction |
| **Wix** | `static.wixstatic.com`, `wix-public`, `.wix-*` | CDN paths | Hard to replicate perfectly; has custom layout engine |
| **Next.js** | `id="__next"`, `/_next/static/`, `next/font` artifacts | `/_next/` | If empty `<div id="__next">`, it's SSG or SSR. Both extract cleanly via Playwright. |
| **Nuxt** | `id="__nuxt"`, `/_nuxt/`, `window.__NUXT__` | `/_nuxt/` | Similar to Next.js — Playwright works |
| **Remix** | `__remixContext`, `window.__remixRouteModules` | `/build/_assets/` | |
| **SvelteKit** | `id="svelte"`, `__sveltekit`, `/_app/` | `/_app/` | |
| **Gatsby** | `___gatsby`, `gatsby-image`, `__gatsby-global-css` | `/static/` | |
| **React (bare)** | `<div id="root"></div>` empty, no SSR | `/static/js/main.*.js` | SPA — must use Playwright |
| **Vue (bare)** | `<div id="app"></div>` empty | `/js/app.*.js` | SPA — must use Playwright |

## Ambiguous cases

**"The site works fine in view-source but not in goclone"**
Likely a SPA with client-side hydration that's fast enough to populate the shell before
goclone's HTTP crawl sees it. Use Playwright instead.

**"The page has some content but is missing sections"**
Scroll-triggered lazy loading (common with GSAP ScrollTrigger, IntersectionObserver-based
libraries). Playwright must scroll the entire page before extracting.

**"The HTML has weird class names like w-variant-8c597988..."**
Webflow component variants (design system tokens). Strip them from your extracted class
lists — they're not meaningful for reconstruction.

**"The site uses `style=""` inline everything"**
Webflow IX2 animation system writes inline styles for animated elements. Use
`getComputedStyle()` from a Playwright session instead of reading the inline styles —
the computed values are stable, the inline values change with animation state.

## Animation library fingerprints

| Library | Signal | Reconstruction strategy |
|---|---|---|
| **GSAP** | `gsap.`, `TweenMax`, `ScrollTrigger`, `SplitText` in JS | Keep GSAP, port animation code |
| **Webflow IX2** | `data-w-id`, `Webflow.require('ix2')` | Convert to CSS transitions + IntersectionObserver, or Framer Motion |
| **AOS** | `data-aos`, `aos.js` | CSS keyframes triggered by IntersectionObserver |
| **Framer Motion** | `framer-motion` in bundle, `motion.div` patterns | Keep Framer Motion, port variants |
| **Lenis (smooth scroll)** | `class="lenis"` on html, `Lenis` in bundle | Install `@studio-freight/lenis`, wire up in layout |
| **Locomotive Scroll** | `locomotive-scroll.min.js` | Install `locomotive-scroll`, replicate config |

## How the detector decides `static` vs `spa`

From `scripts/detect-site-type.mjs`:

```js
function isSPAShell(html) {
  // 1. Empty root div (React/Vue/Next markers)
  // 2. Total body text length < 200 characters (all meaningful content rendered client-side)
}
```

If **either** condition is true, the site is classified as SPA and Playwright must be used.
If neither is true, goclone can handle the capture.
