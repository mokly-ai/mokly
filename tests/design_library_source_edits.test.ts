import assert from "node:assert/strict";
import test from "node:test";

import type { EntryChangeReason } from "../packages/viewer/dist/data.js";

import {
  changedEntryPaths,
  impactingIds,
  manifestScreenConsumers,
  reasonsOf,
  screenConsumersOf,
} from "./helpers/attribution_result.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";
import { sourceEdits } from "./helpers/design_library_source_edits.js";
import type { SourceEdit } from "./helpers/design_library_source_edits.js";
import { fileFixture } from "./helpers/file_fixture.js";

interface EditGroup {
  name: string;
  edits: readonly SourceEdit[];
  changes: Readonly<Record<string, readonly EntryChangeReason[]>>;
  impacting: readonly string[];
}

/**
 * Impacting edits rebuild alone so another component cannot mask attribution.
 * Non-impacting edits may share a build only with exact path/reason unions and
 * no affected consumers. Edits at the same path need disjoint reason kinds.
 * Same-file edits targeting different entries must rebuild separately.
 * A subset of another member's reasons can mask an extra change at its path;
 * this rule keeps that limit away from same-file variant attribution.
 * Grouping is a reviewed trade-off, not exact per-edit isolation.
 * Equal or subset signatures stay separate. Regroup when a signature changes.
 */
const groups: readonly EditGroup[] = [
  {
    name: "1: top-bar implementation",
    edits: [sourceEdits.topBarClass],
    changes: {
      "design/library/chrome/top-bar": [
        { kind: "dependency", path: sourceEdits.topBarClass.file },
        { kind: "material" },
      ],
    },
    impacting: ["design/library/chrome/top-bar"],
  },
  {
    name: "2: tag-chip implementation",
    edits: [sourceEdits.tagChipLabel],
    changes: {
      "design/library/controls/tag-chip": [
        { kind: "dependency", path: sourceEdits.tagChipLabel.file },
        { kind: "material" },
      ],
    },
    impacting: ["design/library/controls/tag-chip"],
  },
  {
    name: "3: saved title, screen title and slot, tag and field value",
    edits: [
      sourceEdits.savedTitle,
      sourceEdits.screenTitle,
      sourceEdits.slot,
      sourceEdits.pickerTag,
      sourceEdits.cornerRadius,
    ],
    changes: {
      "design/library/chrome/top-bar/search": [
        { kind: "material" },
        { kind: "metadata" },
      ],
      "design/browse/views/use-case": [
        { kind: "inputs" },
        { kind: "material" },
      ],
      "design/browse/views/screen/tag-picker": [{ kind: "inputs" }],
      "design/components/controls/states/invalid": [{ kind: "material" }],
    },
    impacting: [],
  },
  {
    name: "4: saved query, destination and ordered instances",
    edits: [
      sourceEdits.savedQuery,
      sourceEdits.destination,
      sourceEdits.reorder,
    ],
    changes: {
      "design/library/chrome/top-bar/search": [
        { kind: "material" },
        { kind: "metadata" },
      ],
      "design/browse/views/use-case": [
        { kind: "inputs" },
        { kind: "material" },
        { kind: "structure" },
      ],
    },
    impacting: [],
  },
  {
    name: "5: control label and removed screen instance",
    edits: [sourceEdits.controlLabel, sourceEdits.removal],
    changes: {
      "design/library/chrome/top-bar": [{ kind: "metadata" }],
      "design/browse/views/use-case": [
        { kind: "material" },
        { kind: "structure" },
      ],
    },
    impacting: [],
  },
];

const sharedFixture = fileFixture((owner) => designLibraryFixture(owner));

test("real source edits keep exact ownership, reasons and consumer impact", async (t) => {
  const fixture = await sharedFixture();
  for (const group of groups)
    await t.test(group.name, async () => {
      await fixture.reset();
      for (const { file, change } of group.edits)
        await fixture.edit(file, change);
      const result = await fixture.compare(await fixture.build());
      assert.deepEqual(
        changedEntryPaths(result),
        Object.keys(group.changes).sort(),
      );
      for (const [path, reasons] of Object.entries(group.changes))
        assert.deepEqual(reasonsOf(result, path), reasons, path);
      assert.deepEqual(impactingIds(result), group.impacting);
      if (group.impacting.length === 0)
        assert.deepEqual(result.affectedConsumers, []);
      for (const id of group.impacting) {
        const consumers = manifestScreenConsumers(fixture.before.manifest, id);
        assert.notDeepEqual(consumers, [], id);
        assert.deepEqual(screenConsumersOf(result, id), consumers, id);
      }
    });
});
