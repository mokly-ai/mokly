import assert from "node:assert/strict";
import test from "node:test";

import { behaviourTable } from "../scripts/rebuild/behaviour-table.mjs";
import { adaptLegacyScenario } from "../scripts/rebuild/legacy-adapter.mjs";
import type { LegacyScenario } from "../scripts/rebuild/legacy-adapter.mjs";
import { adaptRustScenario } from "../scripts/rebuild/rust-adapter.mjs";
import type { RustScenario } from "../scripts/rebuild/rust-adapter.mjs";

test("Rust affected contexts retain each side's parent and variant address", () => {
  const contexts = [
    ["before", "component", "other-card/compact", "other-card"],
    ["after", "component", "card/small", "card"],
    ["before", "component", "old-card/removed", "old-card"],
    ["after", "component", "card/added", "card"],
    ["before", "component", "old-card", undefined],
    ["after", "component", "card", undefined],
    ["before", "screen", "old-home", undefined],
  ] as const;
  const evidence = contexts.map(([side, kind, path]) => ({
    side,
    context: {
      kind,
      entry: { path },
      viewport: "mobile",
      colorScheme: "light",
    },
    via: [{ componentId: "button", instanceKey: "ignored" }],
  }));
  const consumer = {
    changedComponentId: "button",
    consumer: { kind: "component", path: "card" },
    evidence,
  };
  const rust = {
    review: {
      schemaVersion: 8,
      entries: [
        {
          kind: "component",
          path: "card",
          before: { path: "old-card" },
          after: { path: "card" },
          views: [],
          variants: [
            {
              path: "card/small",
              before: { path: "other-card/compact" },
              after: { path: "card/small" },
              views: [],
            },
            {
              path: "old-card/removed",
              before: { path: "old-card/removed" },
              views: [],
            },
            { path: "card/added", after: { path: "card/added" }, views: [] },
          ],
        },
      ],
      affected: [consumer],
    },
  } as unknown as RustScenario;
  const legacy = {
    review: {
      schemaVersion: 7,
      affectedConsumers: [
        {
          ...consumer,
          evidence: evidence.map((item, index) => {
            const parent = contexts[index]![3];
            return {
              ...item,
              context: {
                ...item.context,
                entry: { path: parent ?? item.context.entry.path },
                ...(parent ? { variantPath: item.context.entry.path } : {}),
              },
            };
          }),
        },
      ],
    },
  } as unknown as LegacyScenario;
  assert.deepEqual(
    behaviourTable(rust, adaptRustScenario).affectedConsumers,
    behaviourTable(legacy, adaptLegacyScenario).affectedConsumers,
  );
});
