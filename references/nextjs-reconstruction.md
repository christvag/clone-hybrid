# Next.js Reconstruction Guide

How to rebuild a captured site as a production-grade Next.js 15/16 project after
Phase 2 (capture) is complete.

## Scaffold

Prefer reusing `ai-website-cloner-template` if the user has it — it comes pre-configured
with Tailwind v4, shadcn/ui, and a clean `src/` layout.

Otherwise, scaffold fresh:

```bash
npx create-next-app@latest <project-name> \
  --typescript --tailwind --app --no-src-dir \
  --import-alias "@/*" --turbopack --use-npm
```

After scaffold, install shadcn/ui:

```bash
cd <project-name>
npx shadcn@latest init --defaults
npx shadcn@latest add button input card badge
```

## Asset integration

1. Move everything from `_capture/images/` to `public/images/`
2. Move `_capture/fonts/` to `public/fonts/`
3. Move `_capture/videos/` to `public/videos/`
4. Move favicons to `public/` root (Next.js auto-serves `favicon.ico`, `apple-touch-icon.png`, etc.)

## Fonts

### Google Fonts (Inter, Roboto, etc.)

```tsx
// src/app/layout.tsx
import { Inter, Roboto } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });
```

### Custom OTF / WOFF2 (e.g. Libre Caslon Condensed)

```tsx
import localFont from "next/font/local";

const heading = localFont({
  variable: "--font-heading",
  src: [
    { path: "../../public/fonts/LibreCaslon-Regular.otf", weight: "400", style: "normal" },
    { path: "../../public/fonts/LibreCaslon-Italic.otf", weight: "400", style: "italic" },
  ],
});
```

Apply variables on the `<html>` element, then reference them in `globals.css`:

```css
@theme inline {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-heading), "Times New Roman", serif;
}
```

## Design tokens

Write extracted tokens to the `@theme inline` block in `globals.css`. Map Tailwind v4
CSS variables to the source site's palette. Example for a typical marketing site:

```css
:root {
  --ink: #131313;
  --ink-2: #4c4c4c;
  --paper: #ffffff;
  --cream: #efeeeb;
  --dark: #1d1d1d;

  --background: #ffffff;
  --foreground: #131313;
  --primary: #131313;
  --primary-foreground: #ffffff;
  --muted: #f5f5f5;
  --muted-foreground: #4c4c4c;
}
```

## Component layout

Place components under `src/components/<site-name>/` to keep the clone-specific code
isolated from shadcn primitives:

```
src/
  app/
    layout.tsx       # fonts, metadata, <html> wrapper
    page.tsx         # imports + renders all sections in topological order
    globals.css      # design tokens + base styles
  components/
    ui/              # shadcn primitives (button, input, card)
    <site-name>/     # extracted site components
      Navbar.tsx
      Hero.tsx
      About.tsx
      Footer.tsx
      ...
```

## Animation porting

| Source animation | Next.js approach |
|---|---|
| CSS `@keyframes` / `transition` | Keep as CSS in `globals.css` or component `<style>` |
| Webflow IX2 (`data-w-id`) | Rewrite as `useEffect` + IntersectionObserver + CSS transitions |
| GSAP ScrollTrigger | Install `gsap`, wrap in `"use client"` component with `useEffect` |
| Framer Motion | Install `framer-motion`, use `motion.div` + `variants` |
| Lenis smooth scroll | Install `@studio-freight/lenis`, mount in `layout.tsx` with `"use client"` wrapper |

For most Webflow clones, **skip GSAP entirely** and use a simple `useEffect`
scroll listener or IntersectionObserver. The animation quality is indistinguishable
for 90% of use cases and you drop ~80KB of JS.

## Image optimization

Always use `<Image>` from `next/image`:

```tsx
import Image from "next/image";

<Image
  src="/images/hero.avif"
  alt="Descriptive alt text"
  width={800}
  height={600}
  priority // for above-the-fold
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

- `priority` on LCP images
- `fill` for background-positioned images (parent must have `position: relative`)
- `sizes` always set when using `fill` or responsive images

## Metadata + SEO

In `src/app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  title: "Site Title",
  description: "Extracted meta description from source",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Site Title",
    description: "...",
    images: ["/og-image.png"],
    type: "website",
  },
};
```

## Verification checklist

Before reporting the clone complete:

- [ ] `npm run build` exits 0
- [ ] `npm run lint` passes (warnings OK, errors not)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run dev` → open http://localhost:3000 → all sections render
- [ ] Screenshots at 1440 / 768 / 390 match source within visual tolerance
- [ ] Custom fonts load (no Times New Roman fallback visible)
- [ ] All images resolve (no 404s in Network tab)
- [ ] Navbar scroll behavior works if present
- [ ] Hover states work on buttons and cards
- [ ] No console errors
