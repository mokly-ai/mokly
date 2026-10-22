import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import { parseReviewResult } from "../packages/viewer/src/review/result_validation.js";

import {
  coldBaseFixture,
  type DependencyTier,
} from "./helpers/cold_base_fixture.js";
import { reportDuration } from "./helpers/durations.js";
import { git } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

async function children(directory: string) {
  try {
    return await fs.readdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
}

async function absent(file: string) {
  await assert.rejects(fs.stat(file), { code: "ENOENT" });
}

async function findMarker(directory: string): Promise<string | undefined> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === "lifecycle-ran") return file;
    if (entry.isDirectory()) {
      const found = await findMarker(file);
      if (found) return found;
    }
  }
  return undefined;
}

for (const mode of ["config", "flag"] as const) {
  test(
    `scripts-on ${mode} opt-in runs the base lifecycle marker`,
    { timeout: 120_000 },
    async (context) => {
      const fixture = await coldBaseFixture(2, context);
      if (mode === "config") {
        await fs.writeFile(
          path.join(fixture.root, "mokly.config.json"),
          '{"review":{"baseInstallScripts":true}}',
        );
      }
      const result = await command(
        fixture.root,
        "build",
        [
          "--base=HEAD",
          "--out=.context/site",
          "--sidecars=1",
          ...(mode === "flag" ? ["--base-install-scripts"] : []),
        ],
        "plain",
        fixture.env,
        context.signal,
      ).result;
      assert.equal(result.code, 0, result.stderr);
      const cacheLine = result.stdout
        .split("\n")
        .find((line) => line.startsWith("Mokly cache: "));
      assert.ok(cacheLine);
      assert.ok(
        await findMarker(cacheLine.slice("Mokly cache: ".length)),
        `${result.stdout}\n${result.stderr}`,
      );
    },
  );
}

const cases: ReadonlyArray<{ tier: DependencyTier; title: string }> = [
  {
    tier: 1,
    title:
      "a cold base build reuses working dependencies when identities match",
  },
  {
    tier: 2,
    title:
      "a cold base build installs locked dependencies offline without lifecycle scripts",
  },
  {
    tier: 3,
    title:
      "a cold base build warns and uses working dependencies when the offline install fails",
  },
];

for (const { tier, title } of cases) {
  test(title, { timeout: 120_000 }, async (context) => {
    const fixture = await coldBaseFixture(tier, context);
    const { root, cache, base, env } = fixture;
    const working = await git(root, "status", "--porcelain");
    assert.deepEqual(await fs.readdir(cache), []);
    const result = await reportDuration(
      `cold base tier ${tier}`,
      (text) => context.diagnostic(text),
      () =>
        command(
          root,
          "build",
          [
            "--base=HEAD",
            "--out=.context/site",
            "--sidecars=1",
            "--debug-timings",
          ],
          "plain",
          env,
          context.signal,
        ).result,
    );
    assert.equal(result.code, 0, result.stderr);
    const dependencySpans = timings(result.stderr).filter(
      (record) =>
        record.role === "core" && record.stage === "review.base-dependencies",
    );
    assert.deepEqual(
      dependencySpans.map((record) => record.event),
      ["start", "end"],
    );
    assert.equal(dependencySpans[1]!.id, dependencySpans[0]!.id);
    assert.equal(dependencySpans[1]!.status, "ok");
    assert.equal(dependencySpans[1]!.tier, tier);
    const diagnostics = result.stderr
      .split("\n")
      .filter((line) => !line.startsWith("[mokly:timing] "))
      .join("\n");
    assert.equal(
      diagnostics,
      tier === 3
        ? '[mokly/warning] configuration "mokly.config.json": base dependencies at "package-lock.json" could not be installed (installation failed); using working-tree dependencies\n'
        : "",
    );

    const output = path.join(root, ".context/site");
    const index = readCatalogueIndex(
      JSON.parse(
        await fs.readFile(path.join(output, "mokly-viewer/index.json"), "utf8"),
      ),
    );
    assert.equal(index.changesStatus, "ready");
    assert.equal(index.base, "HEAD");
    assert.ok(index.comparisonUrl);
    const review = parseReviewResult(
      JSON.parse(
        await fs.readFile(path.join(output, index.comparisonUrl), "utf8"),
      ),
    );
    assert.equal(review.schemaVersion, 8);
    assert.equal(review.baseCommit, base);
    assert.deepEqual(review.diagnostics, []);
    assert.deepEqual(review.entries, []);
    const welcome = index.pages.find((entry) => entry.path === "welcome");
    assert.ok(welcome);
    assert.equal(welcome.title, "Welcome");
    assert.deepEqual(welcome.changes, {
      status: "ready",
      kind: "unmodified",
      included: false,
    });
    assert.deepEqual(
      index.pages.map((entry) => [entry.path, entry.changes]),
      [
        [
          "dependency",
          {
            status: "ready",
            kind: tier === 2 ? "changed" : "unmodified",
            included: tier === 2,
          },
        ],
        ["source", { status: "ready", kind: "changed", included: true }],
        ["welcome", { status: "ready", kind: "unmodified", included: false }],
      ],
    );
    const prefix = path.posix.dirname(index.comparisonUrl);
    for (const side of ["before", "after"]) {
      for (const [entry, text] of [
        ["welcome", "Welcome"],
        ["source", side === "before" ? "Base source" : "Working source"],
        [
          "dependency",
          side === "before" && tier === 2
            ? "Base dependency"
            : "Working dependency",
        ],
      ] as const) {
        const document = await fs.readFile(
          path.join(
            output,
            prefix,
            "snapshots",
            side,
            "mokly-generated",
            entry,
            "index.html",
          ),
          "utf8",
        );
        assert.ok(document.includes(`<h1>${text}</h1>`), document);
        assert.doesNotMatch(document, /base-dependencies/u);
      }
    }

    const announcements = result.stdout
      .split("\n")
      .filter((line) => line.startsWith("Mokly cache: "));
    assert.equal(announcements.length, 1);
    const namespace = announcements[0]!.slice("Mokly cache: ".length);
    const relative = path.relative(cache, namespace);
    assert.ok(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
      namespace,
    );
    const sources = path.join(namespace, "sources/entries");
    const sourceEntries = await children(sources);
    assert.equal(sourceEntries.length, 1);
    const sourceKey = sourceEntries[0];
    assert.ok(sourceKey);
    assert.match(sourceKey, /^[a-f0-9]{64}$/u);
    assert.notEqual(sourceKey, base);
    const extracted = path.join(sources, sourceKey, "data");
    assert.equal(
      await fs.readFile(path.join(extracted, "specs/source-value.ts"), "utf8"),
      "export const value = 'Base source';",
    );
    await absent(path.join(extracted, "node_modules"));
    const installs = path.join(namespace, "dependencies/entries");
    const entries = await children(installs);
    assert.equal(entries.length, tier === 2 ? 1 : 0);
    for (const entry of entries) {
      const installed = path.join(installs, entry, "data");
      assert.match(
        await fs.readFile(
          path.join(installed, "node_modules/mokly-cold-dependency/index.js"),
          "utf8",
        ),
        /Base dependency/u,
      );
      await fs.access(path.join(installs, entry, "receipt.json"));
      await absent(path.join(installed, ".npm-cache"));
      await absent(path.join(installed, "lifecycle-ran"));
      await absent(
        path.join(
          installed,
          "node_modules/mokly-cold-dependency/lifecycle-ran",
        ),
      );
    }
    await absent(path.join(root, "lifecycle-ran"));
    await absent(
      path.join(root, "node_modules/mokly-cold-dependency/lifecycle-ran"),
    );
    const repeated = await command(
      root,
      "build",
      ["--base=HEAD", "--out=.context/repeated", "--sidecars=1"],
      "plain",
      env,
      context.signal,
    ).result;
    assert.equal(repeated.code, 0, repeated.stderr);
    assert.deepEqual(await children(sources), sourceEntries);
    assert.equal(await git(root, "status", "--porcelain"), working);
  });
}
