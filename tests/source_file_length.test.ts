import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const script = path.resolve("scripts/verification/source-file-length.mjs");

test("changed and untracked source/protocol files enforce their separate limits", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-length-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root });
  git("init", "-q");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  await fs.mkdir(path.join(root, "src"));
  await fs.mkdir(path.join(root, "docs/protocol"), { recursive: true });
  await fs.writeFile(path.join(root, "src/untouched.ts"), "x\n".repeat(310));
  await fs.writeFile(path.join(root, "src/changed.ts"), "x\n");
  git("add", ".");
  git("commit", "-qm", "baseline");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  await fs.writeFile(path.join(root, "src/changed.ts"), "x\n".repeat(301));
  await fs.writeFile(
    path.join(root, "docs/protocol/new.md"),
    "x\n".repeat(251),
  );
  const check = (args: string[]) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  const changed = check([]);
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /src\/changed.ts: 301 lines \(limit 300\)/);
  assert.match(
    changed.stderr,
    /docs\/protocol\/new.md: 251 lines \(limit 250\)/,
  );
  assert.doesNotMatch(changed.stderr, /untouched.ts/);
  const audit = check(["--all"]);
  assert.match(audit.stderr, /src\/untouched.ts: 310 lines \(limit 300\)/);
});
