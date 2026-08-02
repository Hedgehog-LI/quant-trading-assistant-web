#!/usr/bin/env node

// Byte-identical governance sync against the QTA backend control repository.
//
// Usage:
//   node scripts/sync-governance-from-source.mjs --source <control-repo-path> --baseline <commit>
//   node scripts/sync-governance-from-source.mjs --check   --source <control-repo-path> --baseline <commit>
//
// The byte-identical set is repo-agnostic governance scaffolding sourced from the control
// repository and must not be edited locally:
//   - .agents/                 (canonical skills, schema, manifest, skill-evals)
//   - .zcode/                  (agents, commands, config.json) -- excluding session-local .zcode/plans/
//   - scripts/                 (ONLY the governance .mjs scripts in GOVERNANCE_SCRIPTS below) -- excluding this file
//   - .claude/skills/          (generated mirror of .agents/skills/, regenerated via sync-ai-skills.mjs)
//
// NOTE: scripts/ is restricted to an explicit allowlist of governance .mjs files. The backend
// control repo also contains LongPort/Java SDK shell scripts (build/check/verify/inspect-longport*.sh)
// which are backend-coupled and NOT part of the /qta-run governance gate chain, so they are
// intentionally excluded from the byte-set.
//
// Hand-authored and explicitly EXCLUDED from the byte-comparison (frontend-specific):
//   AGENTS.md, CLAUDE.md, docs/**, GOVERNANCE_SOURCE.md, .gitignore
//
// Only node: builtins are used.

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const THIS_FILE_NAME = path.basename(fileURLToPath(import.meta.url));
const TARGET_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..");

// Directories that make up the byte-identical governance set, compared file-for-file against
// the control repo baseline. `.claude/skills/` is a generated mirror of `.agents/skills/` but is
// still part of the byte-set and must match the source baseline byte-for-byte. `scripts/` is handled
// via the explicit GOVERNANCE_SCRIPTS allowlist below (NOT a full-directory copy).
const BYTE_SET_DIRS = [".agents", ".zcode", ".claude/skills"];

// Explicit allowlist of governance .mjs scripts under scripts/. Only these files belong to the
// /qta-run governance gate chain; backend-coupled shell scripts (LongPort/Java SDK) are excluded.
const GOVERNANCE_SCRIPTS = new Set([
  "scripts/check-ai-architecture.mjs",
  "scripts/check-ai-delivery-ready.mjs",
  "scripts/check-ai-task-control.mjs",
  "scripts/create-candidate-manifest.mjs",
  "scripts/evaluate-skill-triggers.mjs",
  "scripts/run-ai-evidence-command.mjs",
  "scripts/run-ai-governance-gates.mjs",
  "scripts/sync-ai-skills.mjs",
  "scripts/tests/ai-governance.test.mjs",
  "scripts/validate-ai-governance.mjs",
  "scripts/zcode-governance-hook.mjs"
]);

const EXCLUDED_PATHS = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "GOVERNANCE_SOURCE.md",
  ".gitignore",
  "scripts/" + THIS_FILE_NAME
]);
const EXCLUDED_PATH_PREFIXES = [
  "docs/",
  ".zcode/plans/"
];

function isExcluded(relative) {
  const normalized = relative.split(path.sep).join("/");
  if (EXCLUDED_PATHS.has(normalized)) return true;
  return EXCLUDED_PATH_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

function parseArgs(argv) {
  const args = { check: false, source: "", baseline: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") args.check = true;
    else if (arg === "--source") args.source = argv[++i] ?? "";
    else if (arg === "--baseline") args.baseline = argv[++i] ?? "";
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.source) throw new Error("--source <control-repo-path> is required");
  if (!args.baseline) throw new Error("--baseline <commit> is required");
  return args;
}

function git(source, args) {
  return execFileSync("git", ["-C", source, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024
  });
}

function gitBlob(source, baseline, sha) {
  return execFileSync("git", ["-C", source, "cat-file", "blob", sha], {
    maxBuffer: 64 * 1024 * 1024
  });
}

// Source file set at baseline: map of relative-path -> blob sha, restricted to the byte-set
// directories (.agents, .zcode minus plans, .claude/skills) PLUS the explicit governance script
// allowlist under scripts/.
function sourceBaselineFiles(source, baseline) {
  // `git ls-tree -r <baseline>` lists "<mode> <type> <sha>\t<path>".
  const listing = git(source, ["ls-tree", "-r", baseline]);
  const files = new Map();
  for (const line of listing.split("\n")) {
    if (!line) continue;
    const metaEnd = line.indexOf("\t");
    if (metaEnd === -1) continue;
    const meta = line.slice(0, metaEnd).split(/\s+/);
    const relative = line.slice(metaEnd + 1).trim();
    if (meta[1] !== "blob") continue;
    const normalized = relative.split(path.sep).join("/");
    // Byte-set directories (.agents, .zcode, .claude/skills); .zcode/plans/ is excluded later.
    const inByteSetDir = BYTE_SET_DIRS.some((dir) => normalized === dir || normalized.startsWith(dir + "/"));
    // Explicit governance script allowlist (NOT all of scripts/).
    const inGovernanceScripts = GOVERNANCE_SCRIPTS.has(normalized);
    if (!inByteSetDir && !inGovernanceScripts) continue;
    files.set(normalized, meta[2]);
  }
  return files;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

// Target file set currently on disk, restricted to the byte-set directories (.agents, .zcode,
// .claude/skills) PLUS the explicit governance script allowlist. Excludes the hand-authored /
// session-local allowlist via isExcluded.
async function targetFilesOnDisk(root) {
  const files = new Set();
  async function walk(directory, prefix) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute, relative);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.add(relative);
      }
    }
  }
  for (const dir of BYTE_SET_DIRS) {
    await walk(path.join(root, ...dir.split("/")), dir);
  }
  // Add allowlisted governance scripts that exist on disk (one-by-one, not a full scripts/ walk,
  // so backend-coupled shell scripts never appear as false drift).
  for (const script of GOVERNANCE_SCRIPTS) {
    const absolute = path.join(root, script.split("/").join(path.sep));
    try {
      const stat = await lstat(absolute);
      if (stat.isFile() || stat.isSymbolicLink()) files.add(script);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return files;
}

async function readTargetFile(root, relative) {
  const absolute = path.join(root, relative.split("/").join(path.sep));
  return readFile(absolute);
}

async function regenerate(root, source, baseline) {
  // 1. .agents/ (full canonical tree).
  await rm(path.join(root, ".agents"), { recursive: true, force: true });
  await cp(path.join(source, ".agents"), path.join(root, ".agents"), { recursive: true });

  // 2. .zcode/ minus plans: agents/, commands/, config.json only.
  await mkdir(path.join(root, ".zcode"), { recursive: true });
  await rm(path.join(root, ".zcode", "agents"), { recursive: true, force: true });
  await cp(path.join(source, ".zcode", "agents"), path.join(root, ".zcode", "agents"), { recursive: true });
  await rm(path.join(root, ".zcode", "commands"), { recursive: true, force: true });
  await cp(path.join(source, ".zcode", "commands"), path.join(root, ".zcode", "commands"), { recursive: true });
  await cp(path.join(source, ".zcode", "config.json"), path.join(root, ".zcode", "config.json"));

  // 3. scripts/: copy ONLY the explicit governance .mjs allowlist from the baseline (NOT all of
  // scripts/; backend-coupled LongPort/Java shell scripts are intentionally excluded).
  const sourceFiles = sourceBaselineFiles(source, baseline);
  await mkdir(path.join(root, "scripts"), { recursive: true });
  for (const [relative, blobSha] of sourceFiles) {
    if (!GOVERNANCE_SCRIPTS.has(relative)) continue;
    const target = path.join(root, relative.split("/").join(path.sep));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, gitBlob(source, baseline, blobSha));
  }

  // 4. .claude/skills/ mirror, regenerated by the standard sync mechanism.
  const syncResult = spawnSync(process.execPath, [path.join(root, "scripts", "sync-ai-skills.mjs")], {
    cwd: root, encoding: "utf8", stdio: "inherit"
  });
  if (syncResult.status !== 0) {
    throw new Error("sync-ai-skills.mjs failed while regenerating the .claude/skills mirror");
  }

  // 5. Record the source commit into GOVERNANCE_SOURCE.md's "last synced" line.
  await recordLastSynced(root, source, baseline);
}

async function recordLastSynced(root, source, baseline) {
  const stamp = new Date().toISOString();
  const resolved = git(source, ["rev-parse", baseline]).trim();
  const provenance = path.join(root, "GOVERNANCE_SOURCE.md");
  let content = "";
  try {
    content = await readFile(provenance, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const line = `Last synced: ${stamp} from frontend-governance-control @ ${resolved}.`;
  if (content.length === 0) {
    await writeFile(provenance, line + "\n", "utf8");
    return;
  }
  const replaced = /^Last synced:.*$/m.test(content)
    ? content.replace(/^Last synced:.*$/m, line)
    : `${content.trimEnd()}\n${line}\n`;
  await writeFile(provenance, replaced, "utf8");
}

async function check(root, source, baseline) {
  const sourceFiles = sourceBaselineFiles(source, baseline);
  const errors = [];
  for (const [relative, blobSha] of sourceFiles) {
    if (isExcluded(relative)) continue;
    let buffer;
    try {
      buffer = await readTargetFile(root, relative);
    } catch (error) {
      errors.push(`missing in target: ${relative} (${error.code ?? error.message})`);
      continue;
    }
    const expected = sha256(gitBlob(source, baseline, blobSha));
    const actual = sha256(buffer);
    if (actual !== expected) errors.push(`byte diff: ${relative}`);
  }
  // Detect local drift: files present in the target byte-set that are NOT in the source baseline
  // (excluding the hand-authored allowlist) are untracked drift.
  const sourceRelative = new Set([...sourceFiles.keys()].filter((p) => !isExcluded(p)));
  const onDisk = await targetFilesOnDisk(root);
  for (const relative of onDisk) {
    if (isExcluded(relative)) continue;
    if (!sourceRelative.has(relative)) errors.push(`extra in target (local drift): ${relative}`);
  }
  return errors;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = path.resolve(args.source);
  try {
    await lstat(path.join(source, ".git"));
  } catch (error) {
    console.error(`--source is not a git repository: ${source} (${error.code ?? error.message})`);
    process.exit(2);
  }
  try {
    git(source, ["cat-file", "-e", `${args.baseline}^{commit}`]);
  } catch {
    console.error(`--baseline commit not found in source repo: ${args.baseline}`);
    process.exit(2);
  }

  if (args.check) {
    const errors = await check(TARGET_ROOT, source, args.baseline);
    if (errors.length > 0) {
      console.error(`${errors.length} byte diff(s) vs ${args.baseline}:`);
      for (const error of errors) console.error(`- ${error}`);
      process.exit(1);
    }
    console.log("0 byte diffs");
    process.exit(0);
  }

  await regenerate(TARGET_ROOT, source, args.baseline);
  console.log(`Governance trees synced from ${args.baseline} and .claude/skills regenerated.`);
}

await main();
