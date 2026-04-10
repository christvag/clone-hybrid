#!/usr/bin/env node
// Set up the Drawbridge visual-annotation workflow for a cloned project.
// Usage: node setup-drawbridge.mjs <project-dir> <source-url>

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";

const [, , projectDir, sourceUrl] = process.argv;
if (!projectDir || !sourceUrl) {
  console.error("Usage: node setup-drawbridge.mjs <project-dir> <source-url>");
  process.exit(1);
}

const PROJECT = path.resolve(projectDir);
const DRAWBRIDGE_DIR = path.join(homedir(), "drawbridge");

function run(cmd, cwd) {
  console.log(`$ ${cmd}${cwd ? ` (cwd: ${cwd})` : ""}`);
  execSync(cmd, { stdio: "inherit", cwd });
}

// 1. Clone or update Drawbridge
if (!existsSync(DRAWBRIDGE_DIR)) {
  run(`git clone https://github.com/breschio/drawbridge.git "${DRAWBRIDGE_DIR}"`);
} else {
  try {
    run("git pull origin main", DRAWBRIDGE_DIR);
  } catch {
    console.log("Drawbridge pull failed — continuing with local copy");
  }
}

// 2. Install deps + build (optional — only if package.json exists)
if (existsSync(path.join(DRAWBRIDGE_DIR, "package.json"))) {
  try {
    run("npm install", DRAWBRIDGE_DIR);
    run("npm run build", DRAWBRIDGE_DIR);
  } catch {
    console.log("Drawbridge build step skipped (may already be built)");
  }
}

// 3. Deploy /bridge slash command
const cmdDir = path.join(PROJECT, ".claude", "commands");
await fs.mkdir(cmdDir, { recursive: true });
const bridgeCmd = `Read the moat-tasks.md and moat-tasks-detail.json files in the project root.
These contain visual annotation tasks created by the Drawbridge Chrome extension.

For each task with status "to do":
1. Read the task description and any attached screenshot
2. Identify the DOM element(s) referenced by the task's selector
3. Make the CSS/HTML change described in the annotation
4. Update the task status to "done" in both moat-tasks.md and moat-tasks-detail.json

Processing modes (pass as argument):
- (no argument or "step"): Process one task at a time, confirm before and after each
- "batch": Group related tasks and process them together with one confirmation
- "yolo": Process all pending tasks autonomously without pausing

After processing, report what was changed and any tasks that could not be completed.
`;
await fs.writeFile(path.join(cmdDir, "bridge.md"), bridgeCmd);
console.log(`✓ Wrote ${path.join(cmdDir, "bridge.md")}`);

// 4. .gitignore entries
const gitignorePath = path.join(PROJECT, ".gitignore");
let existing = "";
try { existing = await fs.readFile(gitignorePath, "utf8"); } catch {}
const entries = [".moat/", "moat-tasks.md", "moat-tasks-detail.json", "screenshots/"];
const toAdd = entries.filter((e) => !existing.split("\n").includes(e));
if (toAdd.length) {
  await fs.writeFile(gitignorePath, existing + (existing && !existing.endsWith("\n") ? "\n" : "") + toAdd.join("\n") + "\n");
  console.log(`✓ Added ${toAdd.length} entries to .gitignore`);
}

// 5. Initialize moat files
const moatDir = path.join(PROJECT, ".moat");
await fs.mkdir(moatDir, { recursive: true });
await fs.writeFile(path.join(moatDir, "config.json"), JSON.stringify({ sourceUrl }, null, 2));
await fs.writeFile(path.join(PROJECT, "moat-tasks.md"), "# Moat Tasks\n\nNo tasks yet. Use the Drawbridge Chrome extension to add some.\n");
await fs.writeFile(path.join(PROJECT, "moat-tasks-detail.json"), "[]\n");
console.log("✓ Initialized .moat/ + task files");

console.log(`
Drawbridge is installed and ready.

Chrome Extension Setup (one-time):
1. Open Chrome → chrome://extensions/
2. Enable Developer mode (top-right toggle)
3. Click "Load unpacked" → select ${path.join(DRAWBRIDGE_DIR, "chrome-extension")}
4. Pin the Drawbridge extension to your toolbar

Usage:
1. Start your dev server (e.g. npm run dev)
2. Open the cloned site in Chrome
3. Click the Drawbridge icon → Connect → select ${PROJECT}
4. Press C to comment on elements, R to draw rectangles, Escape to exit
5. Run /bridge in Claude Code to process annotations
   - /bridge         one task at a time (safest)
   - /bridge batch   group related tasks
   - /bridge yolo    process everything autonomously
`);
