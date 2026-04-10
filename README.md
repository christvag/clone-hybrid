# clone-hybrid

A portable Claude Code skill that clones websites by picking the fastest capture method for
the target: **goclone** for static sites, **Playwright** for SPAs, both for ambiguous cases.
Then reconstructs the site in Next.js, Astro, or plain HTML using spec-first parallel builders.

## What it combines

| From | What we took |
|---|---|
| [`website-cloner`](../website-cloner/) | goclone binary capture, multi-page crawl, framework reconstruction, Drawbridge integration |
| [`clone-website`](https://github.com/JCodesMore/ai-website-cloner-template) | Per-element Playwright extraction, spec-first workflow, parallel builder dispatch, interaction sweep |
| New | Auto-detection of static vs SPA so the right tool runs automatically |

## Folder layout

```
clone-hybrid/
├── SKILL.md              # Main instructions — loaded when the skill runs
├── README.md             # This file
├── install.mjs           # Prereq checker (Node.js ≥20)
├── scripts/
│   ├── detect-site-type.mjs    # Classifies URL as static or SPA
│   ├── capture.mjs             # Orchestrates goclone + Playwright capture
│   ├── crawl-links.mjs         # Multi-page link discovery
│   ├── extract-assets.mjs      # Fills asset gaps goclone misses
│   └── setup-drawbridge.mjs    # Installs Drawbridge visual-fix loop
└── references/
    ├── framework-detection.md  # How to detect source framework
    └── nextjs-reconstruction.md # Next.js-specific build guide
```

Everything is self-contained — no hardcoded paths, no machine-specific env. To import to
another machine or project, copy the folder.

---

## Install — one machine

The skill lives in `~/.claude/skills/clone-hybrid/` (user-level, available in every project).

```bash
# 1. Copy the folder (or clone from a git repo if you've published it)
cp -r /path/to/clone-hybrid ~/.claude/skills/

# 2. Check prereqs
node ~/.claude/skills/clone-hybrid/install.mjs

# 3. Open Claude Code in any project and run:
#    /clone-hybrid https://example.com
```

The installer reports what's missing and how to fix it:

- **Node.js ≥20** — [nodejs.org](https://nodejs.org)
- **Playwright MCP** — attach via Claude Code MCP config
- **goclone** (optional) — [imthaghost/goclone](https://github.com/imthaghost/goclone)
- **`create-next-app` / `create-astro`** — auto-installed via npx on first use

## Install — another workspace

### Option A: User-level (recommended)
Same as above — copy to `~/.claude/skills/clone-hybrid/` on the other machine.
Available in every Claude Code session on that machine.

### Option B: Project-level (checked into a repo)
If you want the skill to travel with a specific project:

```bash
cd /path/to/project
mkdir -p .claude/skills
cp -r ~/.claude/skills/clone-hybrid .claude/skills/
git add .claude/skills/clone-hybrid
git commit -m "Add clone-hybrid skill"
```

Anyone who clones the repo will get the skill automatically in Claude Code.

### Option C: Publish to a git repo

```bash
cd ~/.claude/skills/clone-hybrid
git init && git add . && git commit -m "Initial"
git remote add origin git@github.com:you/clone-hybrid.git
git push -u origin main
```

Then on another machine:

```bash
git clone git@github.com:you/clone-hybrid.git ~/.claude/skills/clone-hybrid
node ~/.claude/skills/clone-hybrid/install.mjs
```

## Portability rules enforced by this skill

1. **No hardcoded paths.** goclone is resolved via `GOCLONE_PATH`, `which goclone`, or common
   install locations (`~/goclone/`, `/usr/local/bin/`, `C:\Users\<you>\goclone\`).
2. **No Python dependency.** All bundled scripts are Node.js to match Claude Code's runtime.
3. **No hardcoded Chrome profile.** Playwright MCP handles browser; we never assume an extension or specific user data dir.
4. **Cross-platform.** Scripts use `path.resolve`, forward slashes, and POSIX-compatible shell
   (bash) invocations so they run on macOS, Linux, WSL, and Git Bash on Windows.
5. **No writes outside the target project directory.** Every artifact the skill creates is
   scoped to the user-provided output directory.

## Usage examples

```text
# Simplest: single static page, defaults to Next.js
/clone-hybrid https://example.com

# SPA to Astro
/clone-hybrid https://my-react-site.com --framework astro

# Multi-page full-site clone
/clone-hybrid https://marketing-site.com --full-site --max-depth 3

# Plain HTML output (no framework)
/clone-hybrid https://landing-page.com --framework html

# Reuse an existing Next.js template project
/clone-hybrid https://example.com --template ~/ai-website-cloner-template
```

## Troubleshooting

**"goclone not found"** — the skill will fall back to Playwright-only capture. To enable
goclone, install it from [imthaghost/goclone](https://github.com/imthaghost/goclone) or set
`GOCLONE_PATH` to point at the binary.

**"Playwright MCP not attached"** — open Claude Code settings, add a browser MCP server.
Playwright and Chrome MCP both work; this skill prefers whichever is available.

**"SPA captured as empty shell"** — the detector thought the site was static but it's actually
a SPA. Re-run with `--mode spa` to force the Playwright path, or let the detector examine the
rendered DOM for longer (pass `--wait 5000`).

**"Build fails after reconstruction"** — check the spec files in `_research/components/`.
The builder receives the spec inline, so any error usually traces back to a missing field or
wrong selector. Fix the spec, re-dispatch the builder for that one component.

## License

MIT — use freely, modify freely, redistribute freely.
