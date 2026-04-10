#!/usr/bin/env node
// Capture orchestrator: runs goclone (if available) or falls back to Playwright-only.
// Playwright extraction itself runs inside Claude Code via the browser MCP tools —
// this script handles the goclone step and prints a JSON plan of what Playwright
// should do next.
//
// Usage:
//   node capture.mjs --mode static|spa|auto --url <url> --out <dir>

import fs from "node:fs/promises";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";

const args = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  return args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
}

const mode = flag("--mode", "auto");
const url = flag("--url");
const out = flag("--out", process.cwd());

if (!url) {
  console.error("Usage: node capture.mjs --mode <auto|static|spa> --url <url> --out <dir>");
  process.exit(1);
}

function resolveGoclone() {
  if (process.env.GOCLONE_PATH && existsSync(process.env.GOCLONE_PATH)) return process.env.GOCLONE_PATH;
  const isWin = platform() === "win32";
  const cmd = isWin ? `where.exe goclone 2>NUL` : `command -v goclone 2>/dev/null`;
  try {
    const found = execSync(cmd, { encoding: "utf8" }).trim().split(/\r?\n/)[0];
    if (found && existsSync(found)) return found;
  } catch {}
  const candidates = [
    path.join(homedir(), "goclone", isWin ? "goclone.exe" : "goclone"),
    "/usr/local/bin/goclone",
    "/opt/homebrew/bin/goclone",
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

async function runGoclone(goclonePath, targetUrl, outDir) {
  const rawDir = path.join(outDir, "_raw");
  await fs.mkdir(rawDir, { recursive: true });
  console.log(`Running goclone → ${rawDir}`);
  const result = spawnSync(goclonePath, [targetUrl], { cwd: rawDir, stdio: "inherit" });
  if (result.status !== 0) {
    console.error("goclone failed");
    return false;
  }
  return true;
}

async function main() {
  const outDir = path.resolve(out);
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.join(outDir, "_reference"), { recursive: true });
  await fs.mkdir(path.join(outDir, "_research"), { recursive: true });
  await fs.mkdir(path.join(outDir, "_research", "components"), { recursive: true });
  await fs.mkdir(path.join(outDir, "_capture"), { recursive: true });

  const goclonePath = resolveGoclone();
  const plan = {
    mode,
    url,
    outDir,
    gocloneAvailable: !!goclonePath,
    gocloneRan: false,
    steps: [],
  };

  if (mode === "auto" || mode === "static") {
    if (goclonePath) {
      const ok = await runGoclone(goclonePath, url, outDir);
      plan.gocloneRan = ok;
      if (ok) {
        plan.steps.push("goclone captured raw HTML/CSS/JS/images into _raw/");
        plan.steps.push("next: run extract-assets.mjs on _raw/ to fill CSS gaps");
      } else {
        plan.steps.push("goclone failed — fall back to Playwright capture");
      }
    } else {
      plan.steps.push("goclone not found — using Playwright-only capture");
    }
  }

  // Playwright plan (executed by Claude Code via browser MCP, not this script)
  plan.playwrightPlan = {
    navigate: url,
    viewports: [
      { name: "desktop", width: 1440, height: 900 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "mobile", width: 390, height: 844 },
    ],
    actions: [
      "navigate and wait for network idle",
      "scroll-sweep entire page in 400px increments to trigger lazy loads",
      "for each viewport: take full-page screenshot, save to _reference/",
      "extract design tokens (fonts, colors, breakpoints) via getComputedStyle",
      "enumerate <img>, <video>, background-images, SVG sprites, font-face urls",
      "download all assets in parallel batches to _capture/",
      "write asset manifest to _capture/manifest.json",
      "per-section computed style + text extraction for PAGE_TOPOLOGY",
      "interaction sweep: scroll, click, hover for BEHAVIORS.md",
    ],
  };

  const planPath = path.join(outDir, "_capture", "capture-plan.json");
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2));
  console.log(`\nCapture plan → ${planPath}`);
  console.log(JSON.stringify(plan, null, 2));
}

await main();
