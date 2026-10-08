import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { minimatch } from "minimatch";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  createTurboFixture,
  dryTurbo,
  gitInputFiles,
  taskHashes,
  withInputEdit,
} from "./helpers/turbo_fixture.js";

interface TaskDefinition {
  inputs: string[];
  outputs: string[];
  dependsOn: string[];
}

interface TurboConfiguration {
  agentGuidance: boolean;
  envMode: string;
  globalPassThroughEnv: string[];
  cacheMaxAge: string;
  cacheMaxSize: string;
  remoteCache: {
    enabled: boolean;
    signature?: boolean;
    apiUrl?: string;
    teamSlug?: string;
    teamId?: string;
  };
  futureFlags?: unknown;
  tasks: Record<string, TaskDefinition>;
}

test("Turbo configuration preserves guidance, integrity, and generated ownership", async () => {
  const config = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "turbo.json"), "utf8"),
  ) as TurboConfiguration;
  assert.equal(config.agentGuidance, false);
  assert.equal(config.envMode, "strict");
  assert.ok(config.globalPassThroughEnv.includes("MOKLY_DIAGNOSTIC"));
  assert.deepEqual(config.remoteCache, { enabled: false });
  assert.equal(config.futureFlags, undefined);
  assert.equal(config.cacheMaxAge, "14d");
  assert.equal(config.cacheMaxSize, "50MB");
  const ignored = (
    await fs.readFile(path.join(repositoryRoot, ".gitignore"), "utf8")
  )
    .split("\n")
    .filter((line) =>
      line.replace(/^\//, "").startsWith("examples/basic/mokly-generated/"),
    )
    .map((line) => line.replace(/^\//, "").replace(/\/$/, "/**"));
  assert.deepEqual(config.tasks["//#example:build"]!.outputs, ignored);
  assert.ok(config.tasks.build!.inputs.includes("$TURBO_ROOT$/tsconfig.json"));
});

test("the dry task graph executes viewer, package, then example with caching enabled", async () => {
  const run = await dryTurbo(repositoryRoot);
  const tasks = new Map(run.tasks.map((task) => [task.taskId, task]));
  assert.deepEqual([...tasks.keys()].sort(), [
    "//#build:package",
    "//#example:build",
    "@mokly/viewer#build",
  ]);
  assert.deepEqual(tasks.get("@mokly/viewer#build")!.dependencies, []);
  assert.deepEqual(tasks.get("//#build:package")!.dependencies, [
    "@mokly/viewer#build",
  ]);
  assert.deepEqual(tasks.get("//#example:build")!.dependencies, [
    "//#build:package",
  ]);
  assert.equal(run.envMode, "strict");
  for (const task of run.tasks)
    assert.equal(task.resolvedTaskDefinition.cache, true);
});

test("declared example inputs invalidate only the example task", async (context) => {
  const root = await createTurboFixture(context);
  const before = taskHashes(await dryTurbo(root));
  for (const input of [
    "examples/basic/specs/catalogue.tsx",
    "examples/basic/mokly.config.ts",
    "examples/basic/renderer.tsx",
    "examples/basic/styles.css",
    "examples/basic/postcss.config.mjs",
    "examples/basic/.browserslistrc",
    "examples/imported-assets/workspace-note-signal.png",
    "docs/protocol/mokly-design-components.md",
  ])
    await withInputEdit(root, input, async () => {
      const after = taskHashes(await dryTurbo(root));
      assert.notEqual(
        after["//#example:build"],
        before["//#example:build"],
        input,
      );
      assert.equal(
        after["//#build:package"],
        before["//#build:package"],
        input,
      );
      assert.equal(
        after["@mokly/viewer#build"],
        before["@mokly/viewer#build"],
        input,
      );
    });
  await withInputEdit(root, "src/index.ts", async () => {
    const after = taskHashes(await dryTurbo(root));
    assert.notEqual(after["//#build:package"], before["//#build:package"]);
    assert.notEqual(after["//#example:build"], before["//#example:build"]);
    assert.equal(after["@mokly/viewer#build"], before["@mokly/viewer#build"]);
  });
});

test("root dependency viewer changes invalidate all task hashes", async (context) => {
  const root = await createTurboFixture(context);
  const before = await dryTurbo(root);
  for (const input of [
    "packages/viewer/src/runtime.ts",
    "packages/viewer/scripts/browser.mjs",
    "packages/viewer/README.md",
    "packages/viewer/tests/historical_baseline.test.tsx",
  ])
    await withInputEdit(root, input, async () => {
      const after = await dryTurbo(root);
      assert.notEqual(
        after.globalCacheInputs.hashOfInternalDependencies,
        before.globalCacheInputs.hashOfInternalDependencies,
        input,
      );
      for (const task of after.tasks)
        assert.notEqual(task.hash, taskHashes(before)[task.taskId], input);
    });
  await withInputEdit(root, "tsconfig.json", async () => {
    const after = await dryTurbo(root);
    assert.equal(
      after.globalCacheInputs.hashOfInternalDependencies,
      before.globalCacheInputs.hashOfInternalDependencies,
    );
    for (const task of after.tasks)
      assert.notEqual(task.hash, taskHashes(before)[task.taskId]);
  });
});

test("unrelated files and ignored leftovers do not affect task hashes", async (context) => {
  const root = await createTurboFixture(context);
  const before = taskHashes(await dryTurbo(root));
  for (const relative of [
    "docs/protocol/ci-task-cache.md",
    "README.md",
    "tests/unrelated.test.ts",
    "plans/unrelated.md",
    "examples/basic/.mokly-write-leftover/stage/stale.tsx",
    "examples/basic/.mokly-review-leftover/stale.tsx",
    "examples/basic/.mokly-cache/stale.json",
    "src/.mokly-write-leftover/stale.ts",
    "src/.context/stale.ts",
    "src/dist/stale.js",
    "examples/basic/mokly-generated/ignored/index.mobile.html",
    "examples/basic/mokly-generated/mokly-manifest.json",
    "examples/basic/mokly-generated/example/workspace.svg",
    "examples/basic/mokly-generated/styles/stale.css",
  ]) {
    const file = path.join(root, relative);
    const original = await fs.readFile(file).catch(() => undefined);
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "unrelated or ignored input\n");
      assert.deepEqual(taskHashes(await dryTurbo(root)), before, relative);
    } finally {
      if (original) await fs.writeFile(file, original);
      else await fs.rm(file, { force: true });
    }
  }
});

test("Turbo's six native platform packages remain optional lockfile entries", async () => {
  const lock = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package-lock.json"), "utf8"),
  ) as {
    packages: Record<
      string,
      { version: string; optional?: boolean; os?: string[]; cpu?: string[] }
    >;
  };
  for (const platform of [
    "darwin-64",
    "darwin-arm64",
    "linux-64",
    "linux-arm64",
    "windows-64",
    "windows-arm64",
  ]) {
    const entry = lock.packages[`node_modules/@turbo/${platform}`];
    assert.ok(entry, platform);
    assert.equal(entry.version, lock.packages["node_modules/turbo"]!.version);
    assert.equal(entry.optional, true);
    assert.ok(entry.os?.length);
    assert.ok(entry.cpu?.length);
  }
});

test("resolved example inputs match Git's authored inventory", async (context) => {
  const root = await createTurboFixture(context);
  const config = JSON.parse(
    await fs.readFile(path.join(root, "turbo.json"), "utf8"),
  ) as TurboConfiguration;
  const inputs = config.tasks["//#example:build"]!.inputs;
  const ignored = inputs
    .filter((input) => input.startsWith("!"))
    .map((input) => input.slice(1));
  const expected = (
    await gitInputFiles(
      root,
      inputs.filter((input) => !input.startsWith("!")),
    )
  )
    .filter(
      (file) =>
        !ignored.some((pattern) => minimatch(file, pattern, { dot: true })),
    )
    .sort();
  const leftovers = path.join(
    root,
    "examples/basic/.context/basic-review/stale.json",
  );
  await fs.mkdir(path.dirname(leftovers), { recursive: true });
  await fs.writeFile(leftovers, "ignored review output\n");
  const run = await dryTurbo(root);
  const task = run.tasks.find(
    (candidate) => candidate.taskId === "//#example:build",
  )!;
  const alwaysInputs = new Set([
    "package.json",
    "package-lock.json",
    "turbo.json",
  ]);
  const actual = Object.keys(task.inputs)
    .filter((file) => !alwaysInputs.has(file))
    .sort();
  assert.deepEqual(actual, expected);
  assert.ok(actual.includes("examples/basic/.browserslistrc"));
  assert.ok(!actual.some((file) => file.includes("/.context/")));
});
