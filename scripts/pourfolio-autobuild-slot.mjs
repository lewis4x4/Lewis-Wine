#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const stateDir = path.join(repoRoot, ".pourfolio-autobuild");
const lockPath = path.join(stateDir, "lock.json");
const staleDir = path.join(stateDir, "stale-locks");
const logPath = path.join(repoRoot, "docs/roadmaps/pourfolio-intelligence-autonomous-build-run-log.md");
const queuePath = path.join(repoRoot, "docs/roadmaps/pourfolio-intelligence-autonomous-build-queue.md");

function nowIso() {
  return new Date().toISOString();
}

function defaultSlotId() {
  return nowIso().replace(/[:.]/g, "-");
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function ensureFiles() {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(staleDir, { recursive: true });
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, `# Pourfolio Intelligence Autonomous Build Run Log\n\nThis file is runtime state for the every-two-hours Pourfolio roadmap builder. It is intentionally git-ignored.\n\nQueue/protocol: \`${path.relative(repoRoot, queuePath)}\`\n\n`);
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function appendLog(event, details = {}) {
  ensureFiles();
  const fields = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${JSON.stringify(String(value))}`)
    .join(" ");
  fs.appendFileSync(logPath, `- ${nowIso()} ${event}${fields ? ` ${fields}` : ""}\n`);
}

function isStale(lock) {
  if (!lock?.expiresAt) return false;
  return Date.now() > new Date(lock.expiresAt).getTime();
}

function archiveStaleLock(lock) {
  ensureFiles();
  const archivePath = path.join(staleDir, `${lock?.slotId ?? defaultSlotId()}.json`);
  try {
    fs.renameSync(lockPath, archivePath);
  } catch {
    fs.rmSync(lockPath, { force: true });
  }
  appendLog("stale_reclaimed", {
    slot: lock?.slotId,
    agent: lock?.agent,
    startedAt: lock?.startedAt,
    expiredAt: lock?.expiresAt,
  });
}

function print(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(exitCode);
}

function acquire(args) {
  ensureFiles();
  const existing = readJson(lockPath);
  if (existing && isStale(existing)) {
    archiveStaleLock(existing);
  } else if (existing) {
    print({ acquired: false, reason: "busy", lock: existing, logPath: path.relative(repoRoot, logPath) }, 2);
  }

  const ttlMinutes = Number(args.ttlMinutes ?? 115);
  const slotId = args.slotId || defaultSlotId();
  const startedAt = nowIso();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const lock = {
    slotId,
    status: "picked_up",
    agent: args.agent || `hermes-cron@${os.hostname()}`,
    pid: process.pid,
    startedAt,
    expiresAt,
    repoRoot,
    roadmapPath: "docs/roadmaps/pourfolio-intelligence-os-roadmap.md",
    queuePath: path.relative(repoRoot, queuePath),
    logPath: path.relative(repoRoot, logPath),
  };

  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(fd, JSON.stringify(lock, null, 2));
    fs.closeSync(fd);
  } catch (error) {
    const current = readJson(lockPath);
    print({ acquired: false, reason: "race_or_busy", error: error.message, lock: current }, 2);
  }

  appendLog("picked_up", { slot: slotId, agent: lock.agent, expiresAt, queue: path.relative(repoRoot, queuePath) });
  print({ acquired: true, lock, lockPath: path.relative(repoRoot, lockPath), logPath: path.relative(repoRoot, logPath) });
}

function release(args, event) {
  ensureFiles();
  const lock = readJson(lockPath);
  const slotId = args.slotId || lock?.slotId || "unknown";
  const mismatch = args.slotId && lock?.slotId && args.slotId !== lock.slotId;
  appendLog(event, {
    slot: slotId,
    agent: lock?.agent || args.agent,
    summary: args.summary,
    commit: args.commit,
    branch: args.branch,
    mismatch: mismatch ? `lock=${lock.slotId}` : undefined,
  });
  if (lock && !mismatch) fs.rmSync(lockPath, { force: true });
  print({ released: Boolean(lock && !mismatch), event, slotId, logPath: path.relative(repoRoot, logPath), mismatch });
}

function status() {
  ensureFiles();
  const lock = readJson(lockPath);
  const logTail = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, "utf8").trim().split("\n").slice(-12)
    : [];
  print({ busy: Boolean(lock && !isStale(lock)), stale: Boolean(lock && isStale(lock)), lock, queuePath: path.relative(repoRoot, queuePath), logPath: path.relative(repoRoot, logPath), logTail });
}

const args = parseArgs(process.argv.slice(2));
switch (args.command) {
  case "acquire":
    acquire(args);
    break;
  case "complete":
    release(args, "complete");
    break;
  case "fail":
    release(args, "failed");
    break;
  case "status":
    status();
    break;
  default:
    process.stderr.write("Usage: node scripts/pourfolio-autobuild-slot.mjs acquire|complete|fail|status [--slot-id ID] [--ttl-minutes 115] [--summary TEXT] [--commit SHA] [--branch NAME]\n");
    process.exit(64);
}
