import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

if (process.platform !== "win32") process.exit(0);
const hint = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
const serials = new Set(hint.volumes.filter((v) => v.kind === "windows").map((v) => v.dev));
const fields = (s) => ({ dev: String(s.dev), ino: String(s.ino), ctimeNs: String(s.ctimeNs), mtimeNs: String(s.mtimeNs), directory: s.isDirectory(), link: s.isSymbolicLink() });
const log = (event, value) => console.log(JSON.stringify({ event, node: process.version, uv: process.versions.uv, ...value }));
const outcome = (promise) => promise.then(fields, (error) => ({ error: error.code }));
async function snapshot(file) {
  const handle = await fs.open(file, "r");
  try { return await handle.stat({ bigint: true }); } finally { await handle.close(); }
}
async function settle(file) {
  const { ctimeNs } = await fs.lstat(file, { bigint: true });
  const age = BigInt(Date.now()) * 1_000_000n - ctimeNs;
  if (age < 60_000_000n) await setTimeout(Number((60_000_000n - age) / 1_000_000n) + 1);
}
await fs.mkdir("target", { recursive: true });
const root = await fs.mkdtemp(path.resolve("target/capture-handle-"));
try {
  for (const [name, change] of [
    ["create", () => fs.writeFile(path.join(root, "child"), "proof")],
    ["rename", () => fs.rename(path.join(root, "child"), path.join(root, "renamed"))],
    ["delete", () => fs.unlink(path.join(root, "renamed"))],
  ]) {
    await settle(root);
    const lstat = await fs.lstat(root, { bigint: true });
    const before = await snapshot(root);
    assert.ok(serials.has(String(before.dev)), "handle dev equals a hinted serial");
    assert.deepEqual([before.ino, before.ctimeNs, before.mtimeNs], [lstat.ino, lstat.ctimeNs, lstat.mtimeNs], "path and handle agree");
    await change();
    const after = await snapshot(root);
    assert.notEqual(after.ctimeNs, before.ctimeNs, `${name}: handle ctimeNs changes`);
    assert.notEqual(after.mtimeNs, before.mtimeNs, `${name}: handle mtimeNs changes`);
    log(`handle-${name}`, { lstat: fields(lstat), before: fields(before), after: fields(after) });
  }
  const target = path.join(root, "target");
  const junction = path.join(root, "junction");
  await fs.mkdir(target);
  await fs.symlink(target, junction, "junction");
  const linkLstat = await fs.lstat(junction, { bigint: true });
  const linkHandle = await snapshot(junction);
  assert.equal(linkLstat.isSymbolicLink(), true, "lstat reports the junction as a link");
  assert.equal(linkHandle.ino, (await snapshot(target)).ino, "a handle follows the junction");
  log("junction", { lstat: fields(linkLstat), handle: fields(linkHandle) });
  const witnessed = path.join(root, "witnessed");
  await fs.mkdir(witnessed);
  const recorded = await snapshot(witnessed);
  await fs.rmdir(witnessed);
  await fs.symlink(target, witnessed, "junction");
  const replaced = await fs.lstat(witnessed, { bigint: true });
  assert.equal(replaced.isSymbolicLink(), true, "a no-follow recheck sees the replacement link");
  log("replacement", { recorded: fields(recorded), replaced: fields(replaced) });
  log("handle-passed", {});
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
