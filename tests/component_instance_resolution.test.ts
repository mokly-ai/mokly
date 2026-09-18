import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveInstance, reviewMaterialKey } from "../dist/index.js";
import { instanceKey } from "../packages/viewer/dist/components/keys.js";
import type { ComponentInstanceRecord } from "../packages/viewer/dist/components/manifest_types.js";

const previous: ComponentInstanceRecord = {
  key: instanceKey({ kind: "entry" }, undefined, "action"),
  id: "action",
  componentId: "action",
  owner: { kind: "entry" },
  order: 0,
  props: {},
  propsKey: reviewMaterialKey({}),
};

for (const propsChanged of [false, true])
  for (const orderChanged of [false, true])
    for (const slotChanged of [false, true])
      test(`resolution truth table: props=${propsChanged} order=${orderChanged} slot=${slotChanged}`, () => {
        const current: ComponentInstanceRecord = {
          ...previous,
          propsKey: propsChanged
            ? reviewMaterialKey({ label: "Next" })
            : previous.propsKey,
          order: orderChanged ? 1 : 0,
          ...(slotChanged ? { slotKey: "b".repeat(64) } : {}),
        };
        const snapshot = structuredClone(current);
        assert.equal(
          resolveInstance(Object.freeze(previous), Object.freeze(current)),
          propsChanged || orderChanged || slotChanged ? "moved" : "present",
        );
        assert.deepEqual(current, snapshot);
      });

test("resolution reports missing for an absent or different key without fallback matching", () => {
  assert.equal(resolveInstance(previous, undefined), "missing");
  assert.equal(
    resolveInstance(previous, { ...previous, key: "f".repeat(64) }),
    "missing",
  );
});

test("resolution normalizes an absent slot and consults only key, propsKey, order and slot", () => {
  const metadata = {
    ...previous,
    componentId: "replacement",
    props: { label: ["string", "Ignored raw data"] },
    source: { path: "moved.tsx", line: 99, column: 2 },
  } as ComponentInstanceRecord;
  assert.equal(resolveInstance(previous, metadata), "present");
  const nullSlot = Object.assign({}, previous, { slotKey: null });
  assert.equal(resolveInstance(previous, nullSlot), "present");
  const slotted = { ...previous, slotKey: "b".repeat(64) };
  assert.equal(resolveInstance(slotted, { ...slotted }), "present");
  assert.equal(resolveInstance(slotted, previous), "moved");
});
