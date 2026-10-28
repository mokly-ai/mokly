import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { EntryDetailV3 } from "../packages/viewer/src/generated/catalogue/EntryDetailV3.js";

import {
  build,
  fixture,
  git,
  json,
  screen,
  write,
} from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { command } from "./helpers/static_publication.js";

test(
  "static terminal and index agree for ready unavailable and disabled Changes",
  { timeout: 120_000 },
  async () => {
    const { root, base } = await fixture();
    try {
      const ready = await build(root);
      assert.equal(ready.index.changesStatus, "ready");
      assert.equal(ready.index.base, "fixture-base");
      const current = [
        ...ready.index.screens,
        ...ready.index.components,
        ...ready.index.pages,
        ...ready.index.documents,
        ...ready.index.useCases,
      ];
      const removed = ready.index.removedEntries.map((record) => record.entry);
      for (const entry of current) {
        const detail = await json<EntryDetailV3>(
          ready.output,
          `mokly-viewer/entries/${entry.path}.json`,
        );
        assert.equal(
          Object.hasOwn(detail, "reasons"),
          entry.changes.status === "ready" && entry.changes.included,
        );
      }
      const count = [...current, ...removed].filter(
        (record) =>
          record.changes.status === "ready" && record.changes.included,
      ).length;
      assert.match(
        ready.stdout,
        new RegExp(`Changes ready · ${count} changes?`, "u"),
      );
      assert.equal(
        ready.stdout.match(/Comparing with fixture-base/gu)?.length,
        1,
      );
      assert.ok(ready.index.comparisonUrl);
      assert.equal(ready.index.baseCommit, base);
      const first = await files(ready.output);
      await build(root);
      assert.deepEqual(await files(ready.output), first);
      await write(root, "broken.config.json", "{invalid");
      await git(root, "add", "broken.config.json");
      await git(root, "commit", "-qm", "broken historical config");
      await git(root, "branch", "broken-base");
      await write(root, "broken.config.json", "{}");
      const unavailable = await build(root, [
        "--config=broken.config.json",
        "--base=broken-base",
      ]);
      assert.equal(unavailable.index.changesStatus, "unavailable");
      assert.equal(unavailable.index.base, "broken-base");
      assert.equal(unavailable.index.comparisonUrl, null);
      assert.deepEqual(unavailable.index.removedEntries, []);
      assert.match(unavailable.stdout, /Changes unavailable · .+/u);
      assert.match(unavailable.stderr, /base .*config/iu);
      for (const entry of current)
        assert.equal(
          Object.hasOwn(
            await json<EntryDetailV3>(
              unavailable.output,
              `mokly-viewer/entries/${entry.path}.json`,
            ),
            "reasons",
          ),
          false,
        );
      assert.ok(
        ![...(await files(ready.output)).keys()].some((name) =>
          name.includes("diffs/generations/"),
        ),
      );
      const disabled = await build(root, ["--no-changes"]);
      assert.equal(disabled.index.changesStatus, "disabled");
      assert.equal(disabled.index.base, undefined);
      assert.equal(disabled.index.comparisonUrl, null);
      assert.deepEqual(disabled.index.removedEntries, []);
      for (const entry of current)
        assert.equal(
          Object.hasOwn(
            await json<EntryDetailV3>(
              disabled.output,
              `mokly-viewer/entries/${entry.path}.json`,
            ),
            "reasons",
          ),
          false,
        );
      assert.ok(
        !/Changes ready|Changes unavailable|Comparing with/u.test(
          disabled.stdout,
        ),
      );
      const restored = await build(root);
      assert.equal(restored.index.changesStatus, "ready");
      assert.equal(restored.index.comparisonUrl, ready.index.comparisonUrl);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "nested static invocations discover the config and use the explicit pinned base",
  { timeout: 120_000 },
  async () => {
    const { root, base } = await fixture();
    try {
      await git(root, "branch", "override-base", "fixture-base");
      const result = await command(
        path.join(root, "specs"),
        "build",
        ["--base=override-base", "--out=.context/nested"],
        "rich",
      ).result;
      assert.equal(result.code, 0, result.stderr);
      const output = path.join(root, ".context/nested");
      const index = await json<{
        base: string;
        baseCommit: string;
        changesStatus: string;
      }>(output, "mokly-viewer/index.json");
      assert.equal(index.base, "override-base");
      assert.equal(index.changesStatus, "ready");
      assert.match(result.stdout, /Comparing with override-base/u);
      assert.equal(index.baseCommit, base);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "Changes-enabled builds deliver build-directory entry names and preserve output after history failure",
  { timeout: 120_000 },
  async () => {
    const { root } = await fixture();
    try {
      const names = [
        "dist",
        "target",
        "build",
        "coverage",
        "mokly-static",
        "test-results",
        "playwright-report",
      ];
      for (const name of names)
        await write(
          root,
          `specs/${name}.screen.html`,
          screen(`<h1>${name}</h1>`),
        );
      const ready = await build(root);
      const output = await files(ready.output);
      const generation = ready.index.comparisonUrl!.slice(0, -1);
      for (const name of names) {
        for (const file of [
          `view/${name}/index.html`,
          `mokly-viewer/entries/${name}.json`,
          `static/mokly-generated/${name}/index.desktop.html`,
          `${generation}/snapshots/after/mokly-generated/${name}/index.desktop.html`,
        ])
          assert.ok(output.has(file), file);
        assert.equal(
          (
            ready.index.screens.find((entry) => entry.path === name)!
              .changes as { kind: string }
          ).kind,
          "added",
        );
      }
      const failed = await command(root, "build", [
        "--out=.context/site",
        "--base=missing-base",
      ]).result;
      assert.equal(failed.code, 1);
      assert.match(failed.stderr, /\[mokly\/git-failed\]/u);
      assert.deepEqual(await files(ready.output), output);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
