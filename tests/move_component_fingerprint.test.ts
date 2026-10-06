import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestEntry } from "@mokly/viewer/data";

import {
  contentMoveSignals,
  moveDocuments,
} from "../packages/mokly/src/review/moves/content.js";
import { pairMoves } from "../packages/mokly/src/review/moves/pair.js";

function catalogue(folder: string, count: number): ManifestEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const common = {
      path: `${folder}/item-${index}`,
      sourcePath: `${folder}/${index}.tsx`,
      title: `Item ${index}`,
      description: "Component",
      relatedDocs: [],
      declaredDependencies: [],
      colorSchemes: ["light"] as const,
      kind: "component" as const,
    };
    return [
      {
        ...common,
        propSchema: { kind: "object" as const, properties: {} },
        slots: [],
        controls: {},
        ownedDependencies: [],
      },
      {
        ...common,
        path: `${common.path}/default`,
        variantOf: common.path,
        props: {},
        suppliedSlots: [],
        componentViews: [],
      },
    ];
  }).flat();
}

test("parent fingerprints include unique variant evidence before full equality checks", () => {
  const count = 80,
    before = catalogue("old", count),
    after = catalogue("new", count);
  const documents = (entries: readonly ManifestEntry[]) =>
    new Map(
      entries.flatMap((entry) =>
        moveDocuments(entry).map(
          (view) => [view.route, `<button>${entry.title}</button>`] as const,
        ),
      ),
    );
  const signals = contentMoveSignals(
    before,
    after,
    documents(before),
    documents(after),
  );
  let comparisons = 0;
  const pairing = pairMoves(before, after, {
    ...signals,
    identical(...args) {
      comparisons++;
      return signals.identical(...args);
    },
  });
  assert.equal(pairing.moves.length, count * 2);
  assert.ok(
    comparisons <= count * 3,
    `expected linear comparisons, observed ${comparisons}`,
  );
});
