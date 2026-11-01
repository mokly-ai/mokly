import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { scenarios } from "../scripts/large/benchmark.js";
import { processRows, treeRss } from "../scripts/large/memory.js";
import { writeJsonArray } from "../scripts/large/run_output.js";
import { commitFixture } from "../scripts/large/setup.js";
import { prepareToolchain } from "../scripts/large/toolchain.js";
import { NATIVE_TARGETS } from "../scripts/release/targets.mjs";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";

const run = promisify(execFile);

test("the harness offers all four measured scenarios", () => {
  assert.deepEqual(scenarios, ["build", "serve", "changes", "watch"]);
});

test("RSS samples include descendants and exclude unrelated processes", () => {
  const rows = processRows("bad row\n1 0 1 10\n2 1 2 20\n3 2 3 30\n4 0 4 900");
  assert.equal(rows.length, 4);
  assert.equal(treeRss(rows, 1), 60);
  assert.equal(treeRss(rows, 2), 50);
  assert.equal(treeRss(rows, 999), 0);
});

test("setup commits stylesheets before the unrelated CSS edit", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-setup-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await generateLargeFixture(root, { areas: 1, screens: 3, rows: 1 });
  await commitFixture(root, 4);
  const git = (...args: string[]) => run("git", args, { cwd: root });
  assert.equal(
    (await git("diff", "--name-only", "main")).stdout.trim(),
    "assets/shared-1.css",
  );
  const baseline = (await git("show", "main:assets/shared-1.css")).stdout;
  assert.equal(
    await fs.readFile(path.join(root, "assets/shared-1.css"), "utf8"),
    baseline + ".scale-unrelated-rule { outline: 1px solid rebeccapurple; }\n",
  );
  assert.equal(
    (await git("ls-files", "--others", "--exclude-standard")).stdout,
    "",
  );
});

test("isolated toolchain packs core, viewer and every native target before locked install", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-toolchain-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const calls: string[][] = [];
  await prepareToolchain(
    repositoryRoot,
    root,
    "install",
    async (file, args, settings) => {
      calls.push([file, ...args]);
      if (args[0] === "pack") {
        const filename = path.basename(settings.cwd) + ".tgz";
        await fs.writeFile(
          path.join(root, "tooling", filename),
          "package bytes",
        );
        return { stdout: JSON.stringify([{ filename }]), stderr: "" };
      }
      assert.equal(settings.cwd, root);
      const pkg = JSON.parse(
        await fs.readFile(path.join(root, "package.json"), "utf8"),
      );
      assert.equal(pkg.dependencies["@mokly/mokly"], "file:tooling/mokly.tgz");
      assert.equal(
        pkg.dependencies["@mokly/viewer"],
        "file:tooling/viewer.tgz",
      );
      assert.match(pkg.dependencies["@firna/ui"], /^\d+\.\d+\.\d+/);
      for (const { name, directory } of NATIVE_TARGETS) {
        assert.equal(
          pkg.dependencies[name] ?? pkg.optionalDependencies[name],
          `file:tooling/${path.basename(directory)}.tgz`,
        );
        assert.equal(pkg.overrides[name], `$${name}`);
      }
      if (args[0] === "install")
        await fs.writeFile(
          path.join(root, "package-lock.json"),
          '{"lockfileVersion":3}',
        );
      else await fs.access(path.join(root, "package-lock.json"));
      return { stdout: "", stderr: "" };
    },
  );
  assert.deepEqual(
    calls.map((call) => call.slice(0, 2)),
    [
      ["npm", "pack"],
      ["npm", "pack"],
      ...NATIVE_TARGETS.map(() => ["npm", "pack"]),
      ["npm", "install"],
      ["npm", "ci"],
    ],
  );
});

test("timing records survive chunk and UTF-8 splits with observer timestamps", async () => {
  const { timingCollector } = await import("../scripts/large/timings.js");
  const collector = timingCollector(() => 150);
  collector.accept("[mokly:timing] not JSON\n[mokly:timing] null\n");
  const event = {
    schemaVersion: 1,
    stage: "config.load",
    event: "end",
    elapsedMs: 9999,
    note: "é",
  };
  const bytes = Buffer.from(`[mokly:timing] ${JSON.stringify(event)}\n`);
  const split = bytes.indexOf(Buffer.from("é")) + 1;
  collector.accept(bytes.subarray(0, split));
  assert.equal(collector.records.length, 0);
  collector.accept(bytes.subarray(split));
  assert.deepEqual(collector.records, [{ event, receivedMs: 150 }]);
});

test("large timing arrays write as valid JSON without one giant string", async (t) => {
  const file = path.join(
    await fs.mkdtemp(path.join(repositoryRoot, ".context/large-timings-")),
    "records.json",
  );
  t.after(() => fs.rm(path.dirname(file), { recursive: true, force: true }));
  const records = Array.from({ length: 20_000 }, (_, index) => ({
    event: { schemaVersion: 1 as const, stage: "detail.build", index },
    receivedMs: index,
  }));
  await writeJsonArray(file, records);
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(parsed.length, records.length);
  assert.deepEqual(parsed.at(-1), records.at(-1));
});

test("a failed CLI preserves a failed measurement and its diagnostic", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-failure-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fixture = await generateLargeFixture(root, {
    areas: 1,
    screens: 2,
    rows: 1,
  });
  await fs.mkdir(path.join(root, ".context"));
  const cli = path.join(root, "node_modules/@mokly/mokly/bin/mokly.mjs");
  await fs.mkdir(path.dirname(cli), { recursive: true });
  await fs.writeFile(
    cli,
    'process.stderr.write("fixture failure\\n"); process.exitCode = 3;',
  );
  const { benchmark } = await import("../scripts/large/benchmark.js");
  await assert.rejects(
    benchmark(
      {
        ...fixture,
        toolchain: { mode: "workspace", installMs: null },
        baseline: "test",
        setupMs: 0,
      },
      ["build"],
      1,
      {
        acceptanceForFixture: async () => ({
          profile: "release",
          target: "test-target",
          binarySha256: "c".repeat(64),
          sourceCommit: "test-commit",
          sourceTree: "test-tree",
          dirty: false,
        }),
      },
    ),
    /exited with 3/,
  );
  const result = JSON.parse(
    await fs.readFile(path.join(root, ".context/measurements.json"), "utf8"),
  );
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].status, "failed");
  assert.match(result.results[0].reason, /fixture failure/);
  assert.equal(result.results[0].elapsedMs, undefined);
});
