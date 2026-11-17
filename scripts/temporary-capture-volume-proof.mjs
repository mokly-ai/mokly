import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const moduleUrl = (name) => pathToFileURL(path.resolve(`packages/mokly/dist/sidecar/${name}.js`));
const { CaptureDurability } = await import(moduleUrl("capture-durability"));
const { captureRuntime, mature, maturityGuard } = await import(moduleUrl("capture-runtime"));
const { CaptureVolumes } = await import(moduleUrl("capture-volumes"));
const hint = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
assert.ok(hint.volumes.length <= 64);
assert.ok(Buffer.byteLength(JSON.stringify(hint)) <= 64 * 1024);
console.log(JSON.stringify({ event: "environment", platform: process.platform, versions: process.versions, hint }));
await fs.mkdir("target", { recursive: true });
const root = await fs.mkdtemp(path.resolve("target/capture-proof-"));
const describe = (stat) => Object.fromEntries(["dev", "ino", "ctimeNs", "mtimeNs"].map((key) => [key, String(stat[key])]));

async function matureDirectory() {
  let stat = await fs.stat(root, { bigint: true });
  const remaining = maturityGuard(stat) - (captureRuntime.now() - stat.ctimeNs) + 1_000_000n;
  if (remaining > 0n) await setTimeout(Number((remaining + 999_999n) / 1_000_000n));
  stat = await fs.stat(root, { bigint: true });
  assert.equal(mature(stat, captureRuntime.now()), true, "private directory is mature before the mutation");
  return stat;
}

try {
  for (const [name, change] of [
    ["create", () => fs.writeFile(path.join(root, "child"), "proof")],
    ["rename", () => fs.rename(path.join(root, "child"), path.join(root, "renamed"))],
    ["delete", () => fs.unlink(path.join(root, "renamed"))],
  ]) {
    const before = await matureDirectory();
    const capture = new CaptureDurability(hint);
    await capture.observe(root, before, false);
    const stable = await capture.finish();
    const current = await captureRuntime.lstat(root);
    const supported = await new CaptureVolumes(hint, captureRuntime).supported(root, before);
    console.log(JSON.stringify({ event: "before-check", operation: name, root, before: describe(before), current: describe(current), now: String(captureRuntime.now()), mature: mature(before, captureRuntime.now()), supported, stable }));
    assert.equal(stable, true, "Node dev and filesystem/root class match the native hint");
    await change();
    const after = await fs.stat(root, { bigint: true });
    assert.notEqual(after.ctimeNs, before.ctimeNs, `${name}: ctimeNs changes`);
    assert.notEqual(after.mtimeNs, before.mtimeNs, `${name}: mtimeNs changes`);
    assert.equal(await capture.finish(), false, `${name}: actual capture witness rejects the mutation`);
    console.log(JSON.stringify({ event: name, before: describe(before), after: describe(after), durableBefore: true, durableAfter: false }));
  }
  console.log(JSON.stringify({ event: "passed", platform: process.platform, node: process.version, libuv: process.versions.uv }));
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
