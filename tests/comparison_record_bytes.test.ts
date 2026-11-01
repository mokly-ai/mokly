/**
 * One comparison publishes the same records in a static build and in Serve:
 * the index's base commit, each compared entry's comparison facts, and the
 * removed entries' details in two-space JSON, byte for byte.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import type { CatalogueReadModel } from "../packages/viewer/src/generated/catalogue/CatalogueReadModel.js";
import type { EntryDetailV4 } from "../packages/viewer/src/generated/catalogue/EntryDetailV4.js";

import { completed, serve } from "./helpers/mokly_serve.js";
import { build, fixture } from "./helpers/static_changes.js";

/** The comparison facts of one current detail, without its deployment fences. */
function facts(detail: EntryDetailV4) {
  return {
    before: detail.before,
    reasons: detail.reasons,
    views: detail.views.map((view) => ({
      viewport: view.viewport,
      colorScheme: view.colorScheme,
      state: view.state,
      ignoredIds: view.ignoredIds,
      resourceEvidence: view.resourceEvidence,
    })),
  };
}

/** Serve the fixture until its comparison is ready and read its records. */
async function served(context: TestContext, root: string) {
  const running = await serve(context, root);
  try {
    const url = await running.ready();
    const { index, detail } = (await completed(
      url,
      context.signal,
      "home",
    )) as { index: CatalogueReadModel; detail: EntryDetailV4 };
    assert.equal(index.changesStatus, "ready");
    const removed: Record<string, string> = {};
    for (const { entry } of index.removedEntries) {
      const response = await fetch(
        new URL(`${index.comparisonUrl}entries/${entry.path}.json`, `${url}/`),
        { signal: context.signal },
      );
      assert.equal(response.status, 200);
      removed[entry.path] = await response.text();
    }
    return { index, detail, removed };
  } finally {
    await running.close();
  }
}

test(
  "build and Serve publish the same comparison records for one comparison",
  { timeout: 120_000 },
  async (context) => {
    const { root, base } = await fixture();
    try {
      const live = await served(context, root);
      const built = await build(root, [], "plain", context.signal);
      const comparison = built.index.comparisonUrl;
      assert.ok(comparison);
      assert.equal(built.index.baseCommit, base);
      assert.equal(live.index.baseCommit, base);
      const home = JSON.parse(
        await fs.readFile(
          path.join(built.output, "mokly-viewer/entries/home.json"),
          "utf8",
        ),
      ) as EntryDetailV4;
      assert.equal(home.before?.path, "home");
      assert.ok(home.views.every((view) => view.state === "changed"));
      assert.ok(
        home.views.every((view) => view.resourceEvidence?.resources.length),
      );
      assert.deepEqual(facts(live.detail), facts(home));
      assert.deepEqual(
        Object.keys(live.removed).sort(),
        built.index.removedEntries.map(({ entry }) => entry.path).sort(),
      );
      for (const [entry, text] of Object.entries(live.removed)) {
        const file: string = await fs.readFile(
          path.join(built.output, comparison, "entries", `${entry}.json`),
          "utf8",
        );
        assert.ok(file.startsWith('{\n  "'), file.slice(0, 40));
        assert.equal(text, file, entry);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
