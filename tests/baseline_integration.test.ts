import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { cacheLayout } from "../dist/baseline/cache_layout.js";
import { SystemBaselineClock } from "../dist/baseline/clock.js";
import { BaselineCommandError } from "../dist/baseline/errors.js";
import { NodeBaselineFileSystem } from "../dist/baseline/filesystem.js";
import { StderrBaselineMaintenanceReporter } from "../dist/baseline/maintenance.js";
import { NodeBaselineProcessRunner } from "../dist/baseline/process.js";
import { RebuiltBaselineReader } from "../dist/baseline/reader.js";
import { CachedBaselineBuilder } from "../dist/baseline/rebuild.js";
import type { BaselineProcessRunner } from "../dist/baseline/types.js";

/** Exercise the actual host boundaries only here; unit tests use an injected host. */
test("real Git baseline lifecycle: reuse, interruption, failure and confinement", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-baseline-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-q");
  git("config", "user.name", "Baseline integration");
  git("config", "user.email", "baseline@example.invalid");
  await fs.mkdir(path.join(root, "entries"));
  await fs.writeFile(
    path.join(root, "entries/page.mockup.tsx"),
    'export const title = "Historical page";\n',
  );
  await fs.writeFile(
    path.join(root, "mokly.config.ts"),
    'export default { entriesDir: "entries", mockupsDir: "generated/catalogue" };\n',
  );
  await fs.writeFile(path.join(root, ".gitignore"), ".mokly-cache/\n");
  await fs.writeFile(path.join(root, "baseline-build.cjs"), buildScript);
  await fs.symlink("baseline-build.cjs", path.join(root, "build-alias"));
  const commit = async (mode: string) => {
    await fs.writeFile(
      path.join(root, "catalogue.json"),
      JSON.stringify({ mode }),
    );
    git("add", "-A");
    git("commit", "-qm", `test: ${mode}`);
    return git("rev-parse", "HEAD");
  };
  const host = new NodeBaselineProcessRunner();
  const filesystem = new NodeBaselineFileSystem();
  const calls: string[][] = [];
  const runner: BaselineProcessRunner = {
    pid: host.pid,
    isAlive: (pid) => host.isAlive(pid),
    run: (request) => {
      calls.push([...request.argv]);
      return host.run(request);
    },
  };
  const builder = new CachedBaselineBuilder(
    filesystem,
    runner,
    new SystemBaselineClock(),
    new StderrBaselineMaintenanceReporter(),
    {
      environment: {
        ...process.env,
        MOKLY_TEST_BASELINE_SECRET: "must-not-cross",
      },
    },
  );
  const request = {
    repoRoot: root,
    commit: await commit("ok"),
    mockupsPath: "generated/catalogue",
    commands: [[process.execPath, "build-alias"]],
  };
  const [first, concurrent] = await Promise.all([
    builder.build(request),
    builder.build(request),
  ]);
  assert.deepEqual([first.cacheHit, concurrent.cacheHit].sort(), [false, true]);
  const initialCalls = calls.length;
  assert.equal((await builder.build(request)).cacheHit, true);
  assert.equal(calls.length, initialCalls);
  const reader = new RebuiltBaselineReader(
    filesystem,
    root,
    first.outputDir,
    request.commit,
    request.mockupsPath,
  );
  assert.match(
    await reader.readFile(request.commit, "generated/catalogue/page.html"),
    /Historical page/,
  );
  const layout = cacheLayout(root, request.commit);
  assert.equal(await filesystem.stat(layout.source), undefined);

  await filesystem.acquireLock(
    layout.lock,
    Buffer.from('{"pid":2147483647,"startedAt":0}'),
  );
  assert.equal((await builder.build(request)).cacheHit, true);
  assert.equal(await filesystem.stat(layout.lock), undefined);
  await filesystem.acquireLock(
    layout.lock,
    Buffer.from('{"pid":2147483647,"startedAt":0}'),
  );
  const oldIdentity = (await filesystem.stat(layout.lock))!.identity;
  const reclaimed = await Promise.all([
    filesystem.reclaimLock(layout.lock, oldIdentity),
    filesystem.reclaimLock(layout.lock, oldIdentity),
  ]);
  assert.equal(reclaimed.filter(Boolean).length, 1);
  await filesystem.acquireLock(
    layout.lock,
    Buffer.from(JSON.stringify({ pid: process.pid })),
  );
  assert.equal(await filesystem.reclaimLock(layout.lock, oldIdentity), false);
  assert.ok(await filesystem.stat(layout.lock));
  await filesystem.remove(layout.lock);

  await fs.rm(layout.marker);
  await fs.mkdir(layout.source);
  await fs.writeFile(path.join(layout.source, "partial"), "interrupted");
  assert.equal((await builder.build(request)).cacheHit, false);
  assert.equal(await filesystem.stat(layout.source), undefined);
  await fs.symlink("page.html", path.join(first.outputDir, "alias.html"));
  await assert.rejects(
    reader.readFile(request.commit, "generated/catalogue/alias.html"),
    /symlink/,
  );
  await fs.rm(path.join(first.outputDir, "alias.html"));

  const interrupted = { ...request, commit: await commit("wait") };
  const controller = new AbortController();
  t.after(() => controller.abort());
  const pending = builder.build({ ...interrupted, signal: controller.signal });
  const rejected = assert.rejects(pending, { code: "baseline-interrupted" });
  const interruptedLayout = cacheLayout(root, interrupted.commit);
  const pidPath = path.join(interruptedLayout.source, "command.pid");
  let pid: number | undefined;
  for (let attempt = 0; attempt < 250 && pid === undefined; attempt++) {
    try {
      pid = Number(await fs.readFile(pidPath, "utf8"));
    } catch {
      await setTimeout(20);
    }
  }
  assert.ok(pid);
  const descendantPath = path.join(interruptedLayout.source, "descendant.pid");
  let descendant: number | undefined;
  for (let attempt = 0; attempt < 250 && descendant === undefined; attempt++) {
    try {
      descendant = Number(await fs.readFile(descendantPath, "utf8"));
    } catch {
      await setTimeout(20);
    }
  }
  assert.ok(descendant);
  controller.abort();
  await rejected;
  assert.equal(host.isAlive(pid), false);
  if (host.isAlive(descendant)) {
    assert.equal(process.platform, "linux");
    assert.match(
      await fs.readFile(`/proc/${descendant}/stat`, "utf8"),
      /^\d+ \(.+\) Z /,
    );
  }
  assert.equal(await filesystem.stat(interruptedLayout.marker), undefined);
  assert.equal(await filesystem.stat(interruptedLayout.source), undefined);

  const failed = { ...request, commit: await commit("fail") };
  await assert.rejects(builder.build(failed), (error) => {
    assert.ok(error instanceof BaselineCommandError);
    assert.equal(error.exitCode, 17);
    assert.equal(error.commandIndex, 0);
    assert.match(error.outputLines.join("\n"), /failure from consumer/);
    return true;
  });
  const linkedOutput = { ...request, commit: await commit("output-link") };
  await assert.rejects(builder.build(linkedOutput), {
    code: "baseline-output-invalid",
  });
  await fs.symlink("../outside", path.join(root, "outward"));
  const outward = { ...request, commit: await commit("outward-link") };
  await assert.rejects(builder.build(outward), {
    code: "baseline-extraction-failed",
  });
  await assert.rejects(builder.build({ ...request, commit: "0".repeat(40) }), {
    code: "baseline-history-unavailable",
  });
  assert.equal(git("status", "--porcelain"), "");
});

const buildScript = `const fs = require("node:fs");
if (process.env.MOKLY_TEST_BASELINE_SECRET) throw new Error("Leaked environment");
const mode = JSON.parse(fs.readFileSync("catalogue.json", "utf8")).mode;
if (mode === "wait") {
  require("node:child_process").spawn(process.execPath, ["-e", 'process.on("SIGTERM", () => {}); require("node:fs").writeFileSync("descendant.pid", String(process.pid)); setInterval(() => {}, 1000);'], { stdio: "inherit" });
  fs.writeFileSync("command.pid", String(process.pid));
  setInterval(() => {}, 1000);
} else if (mode === "fail") {
  console.error("failure from consumer");
  process.exit(17);
} else {
  const root = "generated/catalogue";
  fs.mkdirSync(root, { recursive: true });
  const sourcePath = "entries/page.mockup.tsx";
  fs.writeFileSync(root + "/mokly-manifest.json", JSON.stringify({
    schemaVersion: 5, generatedBy: "mokly", sourceFiles: ["catalogue.json", sourcePath, "mokly.config.ts"],
    entries: [{ id: "page", kind: "page", route: "page.html", title: "Historical page", description: "A tiny consumer catalogue", navPath: [], sourcePath, relatedDocs: [], dependencies: [sourcePath], declaredDependencies: [] }]
  }));
  fs.writeFileSync(root + "/page.html", "<!doctype html><html><body>Historical page</body></html>");
  if (mode === "output-link") fs.symlinkSync("page.html", root + "/alias.html");
}
`;
