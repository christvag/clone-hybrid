#!/usr/bin/env node
// Cross-platform prereq checker for clone-hybrid skill.
// Usage: node install.mjs

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform, homedir } from "node:os";
import path from "node:path";

const isWin = platform() === "win32";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const ok = (msg) => console.log(`${GREEN}✓${RESET} ${msg}`);
const warn = (msg) => console.log(`${YELLOW}⚠${RESET} ${msg}`);
const fail = (msg) => console.log(`${RED}✗${RESET} ${msg}`);
const dim = (msg) => console.log(`${DIM}  ${msg}${RESET}`);

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function which(binary) {
  const cmd = isWin ? `where.exe ${binary}` : `command -v ${binary}`;
  return tryExec(cmd);
}

let allOk = true;

console.log("\nclone-hybrid install check\n");

// Node.js
const nodeVersion = process.version.replace("v", "");
const major = parseInt(nodeVersion.split(".")[0], 10);
if (major >= 20) {
  ok(`Node.js ${nodeVersion}`);
} else {
  fail(`Node.js ${nodeVersion} — need ≥20`);
  dim("Install from https://nodejs.org (LTS)");
  allOk = false;
}

// npm + npx (bundled with Node, but verify)
if (which("npm")) ok(`npm — ${tryExec("npm --version")}`);
else {
  fail("npm not found");
  allOk = false;
}

// goclone (optional but recommended for static sites)
const goclonePaths = [
  process.env.GOCLONE_PATH,
  which("goclone"),
  path.join(homedir(), "goclone", isWin ? "goclone.exe" : "goclone"),
  "/usr/local/bin/goclone",
  "/opt/homebrew/bin/goclone",
].filter(Boolean);

let gocloneFound = false;
for (const p of goclonePaths) {
  if (p && existsSync(p)) {
    ok(`goclone — ${p}`);
    gocloneFound = true;
    break;
  }
}
if (!gocloneFound) {
  warn("goclone not found (optional)");
  dim("Install: https://github.com/imthaghost/goclone");
  dim("Or set GOCLONE_PATH env var");
  dim("Skill will fall back to Playwright-only capture");
}

// Playwright MCP / browser MCP — can't check directly from Node, just hint
warn("Playwright MCP — checked at runtime by Claude Code");
dim("The skill needs a browser MCP server attached (Playwright or Chrome MCP)");
dim("Configure in ~/.claude/settings.json or project .mcp.json");

// Framework CLI availability (informational only — npx auto-installs)
if (which("create-next-app") || tryExec("npm ls -g create-next-app")) {
  ok("create-next-app available");
} else {
  warn("create-next-app — will auto-install via npx on first use");
}

// Summary
console.log();
if (allOk) {
  console.log(`${GREEN}Ready.${RESET} Run /clone-hybrid <url> in any Claude Code session.`);
  process.exit(0);
} else {
  console.log(`${RED}Missing required dependencies.${RESET} See messages above.`);
  process.exit(1);
}
