---
name: clone-hybrid
description: >
  Hybrid website cloner that combines goclone (fast raw asset crawl) with Playwright (SPA DOM
  extraction and getComputedStyle), then reconstructs into Next.js, Astro, or plain HTML with
  spec-first parallel builders. Use whenever the user wants to clone, replicate, mirror,
  reverse-engineer, or rebuild an existing website — triggered by phrases like "clone this site",
  "copy this design", "recreate this page", "make my site look like this", "rebuild in Next.js",
  or when the user provides a URL and asks to build something based on it. Combines the speed of
  goclone with the fidelity of per-element Playwright extraction and the structure of spec-first
  component reconstruction. Works on static marketing sites (Webflow, WordPress, Squarespace)
  AND SPAs (React, Vue, Angular) automatically.
---

# Clone Hybrid

A merged cloning pipeline that picks the fastest capture method for the target and produces
clean, framework-idiomatic reconstructions. Combines three existing approaches:

- **goclone** → fast HTTP crawl of static assets (HTML, CSS, JS, images)
- **Playwright MCP** → full DOM + computed styles + interaction sweep for SPAs and dynamic content
- **Spec-first builders** → per-section component specifications with parallel builder dispatch

## Prerequisites

Run `node <skill-dir>/install.mjs` to check all prerequisites. The installer reports what's
missing and where to get it. Required:

- **Node.js 20+** — for all bundled scripts
- **Playwright MCP** (or another browser MCP) — attached to Claude Code
- **goclone binary** (optional but recommended) — detected via:
  1. `GOCLONE_PATH` env var
  2. `which goclone` / `where.exe goclone`
  3. Common install paths (`~/goclone/goclone.exe`, `/usr/local/bin/goclone`)
  - If missing, the skill falls back to Playwright-only capture (slower but works)
- **Target framework CLIs** — `create-next-app`, `create-astro`, or none for plain HTML

## Phase 0: Gather Requirements

Confirm with the user (use defaults if they provide only a URL):

1. **Target URL(s)** — one or many; multi-URL triggers parallel cloning
2. **Target framework** — Next.js + Tailwind + shadcn (default), Astro + Tailwind, or plain HTML
3. **Output directory** — default: current working directory
4. **Scope** — single page (default) or full site (multi-page crawl)
5. **Fidelity** — pixel-perfect (default) or approximate
6. **Existing template** — if user has the `ai-website-cloner-template` checkout, reuse it

## Phase 1: Site Type Detection

Run `node <skill-dir>/scripts/detect-site-type.mjs <url>`. It fetches the URL once and reports:

- `type`: `static` (Webflow, WordPress, Squarespace, plain HTML) or `spa` (React, Vue, Angular)
- `framework`: detected source framework
- `hasAnimations`: GSAP, AOS, Webflow IX2, Framer Motion, etc.
- `assetHints`: CDN patterns, image formats used, font hosts
- `linkCount`: number of internal links (for multi-page scope decisions)

**Decision:**
- `static` → use goclone for capture, Playwright for interaction sweep
- `spa` → skip goclone (empty shell), use Playwright for everything
- Unsure → try goclone first, fall back to Playwright if HTML looks empty

## Phase 2: Capture

### Static path (goclone + Playwright gap fill)

```bash
node <skill-dir>/scripts/capture.mjs --mode static --url <url> --out <dir>
```

This wrapper:
1. Runs `goclone <url>` into `<dir>/_raw/`
2. Runs Playwright capture for dynamic assets goclone misses (fonts, background-images, srcset, SVG sprites, favicons)
3. Extracts CSS asset gaps via `extract-assets.mjs`
4. Saves full-page screenshots at 1440 / 768 / 390 widths to `<dir>/_reference/`
5. Writes a capture manifest at `<dir>/_capture/manifest.json`

### SPA path (Playwright only)

```bash
node <skill-dir>/scripts/capture.mjs --mode spa --url <url> --out <dir>
```

This runs the full Playwright pipeline:
1. Navigate, wait for network idle
2. Force-scroll entire page (triggers lazy-load, ScrollTrigger, IntersectionObserver reveals)
3. Extract `document.documentElement.outerHTML` (the rendered DOM)
4. Enumerate all `<img>`, `<video>`, background-images, SVG sprites, font faces
5. Download all assets in parallel batches (6 concurrent)
6. Extract design tokens: fonts, colors, breakpoints
7. Capture per-section text content + computed styles
8. Save screenshots + snapshot at 3 breakpoints

### Multi-page (either mode)

```bash
node <skill-dir>/scripts/crawl-links.mjs <url> --max-depth 3 --same-origin > pages.json
```

Then run capture per URL and reorganize outputs into page-specific subdirectories.

## Phase 3: Behavior + Topology Extraction

Regardless of mode, run Playwright through the "interaction sweep":

1. **Scroll sweep** — capture navbar states at scroll 0 vs scroll 600; note which sections fade/slide/auto-switch on scroll
2. **Click sweep** — click every tab, pill, button; record state changes
3. **Hover sweep** — hover interactive elements; record transition deltas
4. **Responsive sweep** — resize to 1440 / 768 / 390; note which sections reflow

Save findings to `<dir>/_research/BEHAVIORS.md` and a top-to-bottom topology to
`<dir>/_research/PAGE_TOPOLOGY.md`.

## Phase 4: Component Specification

For each section identified in PAGE_TOPOLOGY.md, write a spec file at
`<dir>/_research/components/<name>.spec.md`. Every spec must contain:

- Screenshot reference
- **Interaction model** (static / click / scroll / time-driven)
- Exact computed CSS values (not estimated) for container and each child
- All states (hover, scroll-triggered, tab-switched) with the before/after diff
- Per-state content if tabbed
- Asset references (local paths only, after Phase 2 download)
- Verbatim text content
- Responsive behavior at 3 breakpoints

**Complexity budget:** if a single spec exceeds ~150 lines of content, split the section.
Reference `<skill-dir>/references/spec-template.md` for the full template.

## Phase 5: Foundation Build

This is sequential, not delegated to an agent.

1. Scaffold the target framework (or reuse the `ai-website-cloner-template` if user has it):
   - Next.js: `npx create-next-app@latest <dir> --typescript --tailwind --app --no-src-dir --import-alias "@/*"`
   - Astro: `npm create astro@latest <dir> -- --template minimal --typescript strict --yes`
   - Plain HTML: initialize from `<skill-dir>/templates/html-starter/` (if bundled)
2. Move downloaded assets from `_capture/` to `public/` (Next/Astro) or `assets/` (HTML)
3. Configure fonts via `next/font` (Google Fonts) or `next/font/local` (custom .otf/.woff)
4. Rewrite `globals.css` / equivalent with extracted design tokens (colors, radii, spacing)
5. Extract inline `<svg>` elements from the source HTML into a shared icons module
6. Verify `npm run build` passes

## Phase 6: Parallel Builder Dispatch

For each component spec in `_research/components/`, dispatch a builder agent via the Agent tool.
Each builder receives:

- The full spec file contents inline in the prompt
- The target file path (e.g., `src/components/HeroSection.tsx`)
- The screenshot path
- Shared primitive imports (icons, buttons, cn utility)
- Instruction to verify `npx tsc --noEmit` before finishing

Run builders in parallel — they work in git worktrees (if the project is a git repo) or
in-place (merge serially). As each finishes, merge and verify the build still passes.

**For small scopes (< 5 components)**, skip worktree orchestration and build components
directly from the main conversation. Worktree overhead isn't worth it for small jobs.

## Phase 7: Page Assembly

Wire everything together in `src/app/page.tsx` (Next.js) or equivalent:

- Import all section components in topological order
- Implement page-level layout (scroll containers, z-index layering, sticky positioning)
- Wire up page-level behaviors: scroll snap, IntersectionObserver reveals, smooth scroll libs
- Verify `npm run build` passes

## Phase 8: Visual QA Diff

Start the dev server, then use Playwright MCP to:

1. Screenshot clone at 1440 / 768 / 390 widths
2. Screenshot original at same widths
3. Compare section-by-section
4. For each discrepancy:
   - If spec was wrong → re-extract from browser MCP, update spec, fix component
   - If spec was right but builder missed it → fix component
5. Test interactive behaviors: scroll, click, hover
6. Re-run `npm run build` to confirm clean

## Phase 9: Drawbridge Integration (optional)

If the user wants an iterative visual-fix loop, run:

```bash
node <skill-dir>/scripts/setup-drawbridge.mjs <project-dir> <source-url>
```

This clones `https://github.com/breschio/drawbridge`, builds the Chrome extension, deploys a
`/bridge` slash command to `<project>/.claude/commands/`, and adds `.moat/` entries to
`.gitignore`. Tell the user how to load the extension and connect it to the project.

## Completion Report

When done, report:
- Source URL + detected framework
- Target framework + project location
- Pages cloned / components created
- Spec files written
- Assets downloaded (count + total size)
- Build status
- Visual QA discrepancies (if any)
- Next steps (run dev server, load Drawbridge, content updates)

## Anti-patterns (DO NOT DO)

- **Don't run goclone on SPAs.** It gets empty shells. Use Playwright.
- **Don't skip the interaction sweep.** Scroll-triggered content is invisible in static screenshots.
- **Don't build click-based tabs when the original is scroll-driven.** Verify the interaction model first (scroll before clicking).
- **Don't dispatch builders without a spec file.** The spec is the contract — skipping it means the builder guesses.
- **Don't hardcode the goclone path.** Always resolve via env var or `which` — the skill must be portable.
- **Don't reference docs from builder prompts.** Each builder receives its spec inline.
- **Don't extract only the default state.** For tabs/scroll-triggered elements, capture every state.
- **Don't miss layered assets.** A section that looks like one image is often a background + 1-3 overlay images.
