import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const scriptPath = path.resolve("scripts/pourfolio-autobuild-slot.mjs");

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "pourfolio-slot-test-"));
  execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
  fs.mkdirSync(path.join(repo, "docs/roadmaps"), { recursive: true });
  fs.writeFileSync(path.join(repo, "docs/roadmaps/pourfolio-intelligence-autonomous-build-queue.md"), "# queue\n");
  return repo;
}

function run(repo, args, options = {}) {
  const result = spawnSync("node", [scriptPath, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
  const payload = result.stdout.trim() ? JSON.parse(result.stdout) : null;
  return { ...result, payload };
}

function assertOk(result) {
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  return result.payload;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function testHeartbeatTimeoutReclaimsDeadSlotBeforeHardTtl() {
  const repo = makeRepo();
  const first = assertOk(run(repo, ["acquire", "--slot-id", "dead-run", "--ttl-minutes", "115", "--heartbeat-timeout-minutes", "0.001"]));
  assert.equal(first.acquired, true);
  await sleep(90);

  const second = assertOk(run(repo, ["acquire", "--slot-id", "recovered-run", "--ttl-minutes", "115"]));
  assert.equal(second.acquired, true);
  assert.equal(second.lock.slotId, "recovered-run");

  const log = fs.readFileSync(path.join(repo, "docs/roadmaps/pourfolio-intelligence-autonomous-build-run-log.md"), "utf8");
  assert.match(log, /stale_reclaimed slot="dead-run"/);
  assert.match(log, /staleReason="heartbeat_timeout"/);
}

async function testHeartbeatKeepsActiveSlotBusy() {
  const repo = makeRepo();
  assertOk(run(repo, ["acquire", "--slot-id", "active-run", "--ttl-minutes", "115", "--heartbeat-timeout-minutes", "1"]));
  const heartbeat = assertOk(run(repo, ["heartbeat", "--slot-id", "active-run", "--summary", "before npm run check"]));
  assert.equal(heartbeat.updated, true);
  assert.equal(heartbeat.slotId, "active-run");
  assert.equal(heartbeat.heartbeatCount, 1);

  const status = assertOk(run(repo, ["status"]));
  assert.equal(status.busy, true);
  assert.equal(status.stale, false);
  assert.equal(status.lock.heartbeatSummary, "before npm run check");
}

await testHeartbeatTimeoutReclaimsDeadSlotBeforeHardTtl();
await testHeartbeatKeepsActiveSlotBusy();
console.log("pourfolio autobuild slot tests passed");
