import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { EntryDetailV2 } from "../packages/viewer/src/generated/catalogue/EntryDetailV2.js";

import { build, git, json, write } from "./helpers/static_changes.js";
import { publicationFixture } from "./helpers/static_publication.js";

test(
  "static Changes compares a removed component parent and its variant",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await write(
        root,
        "mokly.config.json",
        '{"review":{"base":"fixture-base"}}',
      );
      await write(
        root,
        "specs/card.component.html",
        "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nvariants: [{slug: compact, title: Compact, props: {}}]\n---\n<p>Card</p>",
      );
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "base component parent");
      await git(root, "branch", "fixture-base");
      await fs.rm(path.join(root, "specs/card.component.html"));
      const built = await build(root);
      assert.equal(built.index.changesStatus, "ready");
      assert.deepEqual(
        built.index.removedEntries.map(({ entry }) => entry.path),
        ["card", "card/compact"],
      );
      for (const { entry } of built.index.removedEntries) {
        assert.equal(entry.kind, "component");
        if (entry.kind !== "component") continue;
        assert.deepEqual(entry.comparison, {
          status: "ready",
          kind: "removed",
          eligible: true,
        });
        for (const view of entry.views)
          assert.deepEqual(view.comparison, {
            status: "ready",
            kind: "removed",
            eligible: true,
          });
        const detail = await json<EntryDetailV2>(
          built.output,
          `${path.posix.dirname(built.index.comparisonUrl!)}/entries/${entry.path}.json`,
        );
        assert.equal(detail.workspace?.comparisonEligible, true);
        assert.deepEqual(detail.reasons, [{ kind: "removed" }]);
        assert.ok(detail.views.every((view) => view.usage.status === "ready"));
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
