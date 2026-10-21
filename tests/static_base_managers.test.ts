import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import { parseReviewResult } from "../packages/viewer/src/review/result_validation.js";

import { baseManagerFixture } from "./helpers/base_manager_fixture.js";
import { managers } from "./helpers/base_manager_tools.js";
import { coldBaseFixture } from "./helpers/cold_base_fixture.js";
import { write } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

async function build(
  fixture: { root: string; env: NodeJS.ProcessEnv; network?: string },
  signal: AbortSignal,
) {
  const result = await command(
    fixture.root,
    "build",
    ["--base=HEAD", "--out=.context/site", "--sidecars=1", "--debug-timings"],
    "plain",
    fixture.env,
    signal,
  ).result;
  assert.equal(result.code, 0, result.stderr);
  if (fixture.network)
    assert.equal(await fs.readFile(fixture.network, "utf8"), "");
  const span = timings(result.stderr).find(
    (record) =>
      record.stage === "review.base-dependencies" && record.event === "end",
  );
  assert.ok(span, result.stderr);
  assert.equal(span.status, "ok");
  const namespace = result.stdout
    .split("\n")
    .find((line) => line.startsWith("Mokly cache: "))
    ?.slice("Mokly cache: ".length);
  assert.ok(namespace, result.stdout);
  return {
    namespace,
    tier: span.tier,
    diagnostics: result.stderr
      .split("\n")
      .filter((line) => !line.startsWith("[mokly:timing] "))
      .join("\n"),
  };
}

for (const manager of managers) {
  test(
    `a cold ${manager.name} base installs offline without scripts and reuses its dependency cache`,
    { timeout: 120_000 },
    async (context) => {
      const fixture = await baseManagerFixture(manager, context);
      assert.deepEqual(await fs.readdir(fixture.cache), []);
      const first = await build(fixture, context.signal);
      if (first.tier !== 2)
        context.diagnostic(await fs.readFile(fixture.managerOutput, "utf8"));
      assert.equal(first.tier, 2, first.diagnostics);
      assert.equal(first.diagnostics, "");
      const output = path.join(fixture.root, ".context/site");
      const index = readCatalogueIndex(
        JSON.parse(
          await fs.readFile(
            path.join(output, "mokly-viewer/index.json"),
            "utf8",
          ),
        ),
      );
      assert.equal(index.changesStatus, "ready");
      assert.ok(index.comparisonUrl);
      const review = parseReviewResult(
        JSON.parse(
          await fs.readFile(path.join(output, index.comparisonUrl), "utf8"),
        ),
      );
      assert.equal(review.baseCommit, fixture.base);
      for (const [name, kind, included] of [
        ["welcome", "unmodified", false],
        ["dependency", "changed", true],
        ["workspace", "changed", true],
      ] as const) {
        assert.deepEqual(
          index.pages.find((page) => page.path === name)?.changes,
          { status: "ready", kind, included },
        );
      }
      const entries = path.join(first.namespace, "dependencies/entries");
      const keys = await fs.readdir(entries);
      assert.equal(keys.length, 1);
      const installed = path.join(entries, keys[0]!, "data");
      assert.match(
        await fs.readFile(
          path.join(installed, "node_modules/mokly-cold-dependency/index.js"),
          "utf8",
        ),
        /Base dependency/u,
      );
      for (const relative of [
        "lifecycle-ran",
        "node_modules/mokly-cold-dependency/lifecycle-ran",
        "packages/local/lifecycle-ran",
      ]) {
        await assert.rejects(fs.stat(path.join(installed, relative)), {
          code: "ENOENT",
        });
        await assert.rejects(fs.stat(path.join(fixture.root, relative)), {
          code: "ENOENT",
        });
      }
      await fs.writeFile(path.join(installed, "cache-reuse-sentinel"), "keep");
      const calls = await fs.readFile(fixture.calls, "utf8");
      assert.notEqual(calls, "");
      assert.equal(calls.trim().split("\n").length, 1, calls);
      assert.deepEqual(await build(fixture, context.signal), first);
      assert.equal(await fs.readFile(fixture.calls, "utf8"), calls);
      assert.equal(
        await fs.readFile(path.join(installed, "cache-reuse-sentinel"), "utf8"),
        "keep",
      );
    },
  );
}

for (const manager of [managers[0], managers[1]]) {
  for (const mode of ["missing", "version"] as const) {
    test(
      `a cold ${manager.name} base warns when its manager is ${mode}`,
      { timeout: 120_000 },
      async (context) => {
        const fixture = await baseManagerFixture(manager, context, mode);
        const result = await build(fixture, context.signal);
        assert.equal(result.tier, 3);
        assert.match(result.diagnostics, /base dependencies at/u);
        assert.ok(
          result.diagnostics.includes(
            mode === "missing"
              ? "package manager or lockfile unavailable"
              : "package manager version unsupported",
          ),
          result.diagnostics,
        );
        assert.equal(await fs.readFile(fixture.calls, "utf8"), "");
      },
    );
  }
}

test(
  "a cold Yarn Plug'n'Play base gives its resolver fallback reason",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await baseManagerFixture(managers[2], context, "pnp");
    const result = await build(fixture, context.signal);
    assert.equal(result.tier, 3);
    assert.match(result.diagnostics, /Yarn Plug'n'Play is unsupported/u);
    assert.equal(await fs.readFile(fixture.calls, "utf8"), "");
  },
);

test(
  "a cold Yarn Berry base with exec dependencies falls back without running the generator",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await baseManagerFixture(managers[2], context, "exec");
    const result = await build(fixture, context.signal);
    assert.equal(result.tier, 3);
    assert.match(result.diagnostics, /invalid dependency input/u);
    assert.equal(await fs.readFile(fixture.calls, "utf8"), "");
    await assert.rejects(
      fs.stat(path.join(fixture.root, "historical-exec-ran")),
      {
        code: "ENOENT",
      },
    );
  },
);

test(
  "a cold Yarn Berry base disables constraints code from the historical tree",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await baseManagerFixture(
      managers[2],
      context,
      "constraints",
    );
    const result = await build(fixture, context.signal);
    assert.equal(result.tier, 2, result.diagnostics);
    assert.equal(result.diagnostics, "");
    await assert.rejects(
      fs.stat(path.join(fixture.root, "historical-constraints-ran")),
      { code: "ENOENT" },
    );
  },
);

for (const manager of [managers[0], managers[3], managers[4]]) {
  test(
    `a ${manager.name} base keeps configured install paths inside its private entry`,
    { timeout: 120_000 },
    async (context) => {
      const fixture = await baseManagerFixture(manager, context, "paths");
      const result = await build(fixture, context.signal);
      assert.equal(result.tier, 2, result.diagnostics);
      assert.equal(result.diagnostics, "");
      const entries = path.join(result.namespace, "dependencies/entries");
      const keys = await fs.readdir(entries);
      assert.equal(keys.length, 1);
      assert.deepEqual(
        (await fs.readdir(path.join(entries, keys[0]!))).sort(),
        ["data", "receipt.json"],
      );
    },
  );
}

test(
  "npm-only configuration edits keep the existing equal-identity tier",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await coldBaseFixture(1, context);
    await write(
      fixture.root,
      ".npmrc",
      "offline=true\n# working configuration comment\n",
    );
    const result = await build(fixture, context.signal);
    assert.equal(result.tier, 1, result.diagnostics);
    assert.equal(result.diagnostics, "");
  },
);
