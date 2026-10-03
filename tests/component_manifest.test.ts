import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseManifest,
  parseHistoricalManifest,
} from "../dist/registry/manifest.js";
import type {
  ManifestComponent,
  ManifestComponentVariant,
  ComponentViewRecord,
} from "../packages/viewer/dist/components/manifest_types.js";
import type {
  ManifestV8,
  ManifestScreen,
} from "../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

type ComponentManifestScreen = ManifestScreen & {
  componentViews: readonly ComponentViewRecord[];
};

async function example(t: {
  after: (fn: () => Promise<void>) => void;
}): Promise<ManifestV8> {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const result = await compileCatalogue(await loadConfig(fixture.root));
  assert.equal(result.manifest.schemaVersion, 8);
  return result.manifest;
}

test("manifest v8 rejects broken identities, ownership references and props before readers can suppress changes", async (t) => {
  const original = await example(t);
  const edits: readonly [
    string,
    (
      value: ManifestV8,
      screen: ComponentManifestScreen,
      component: ManifestComponent,
      variant: ManifestComponentVariant,
    ) => void,
  ][] = [
    ["unknown schema", (value) => Object.assign(value, { schemaVersion: 9 })],
    [
      "removed dependency field",
      (_v, screen) => Object.assign(screen, { dependencies: [] }),
    ],
    [
      "removed declaration field",
      (_v, screen) => Object.assign(screen, { declaredDependencies: [] }),
    ],
    [
      "removed owner field",
      (_v, _s, component) =>
        Object.assign(component, { ownedDependencies: [] }),
    ],
    [
      "unknown component field",
      (_v, _s, component) => Object.assign(component, { unexpected: true }),
    ],
    [
      "missing views",
      (_v, screen) => Reflect.deleteProperty(screen, "componentViews"),
    ],
    [
      "missing axis",
      (_v, screen) =>
        Object.assign(screen, {
          componentViews: screen.componentViews.slice(1),
        }),
    ],
    [
      "invalid props key",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!.instances[0]!, {
          propsKey: "a".repeat(64),
        }),
    ],
    [
      "invalid identity digest",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!.instances[0]!, {
          key: "a".repeat(64),
        }),
    ],
    [
      "unknown instance field",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!.instances[0]!, {
          selector: "body",
        }),
    ],
    [
      "duplicate instance",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!, {
          instances: [
            ...screen.componentViews[0]!.instances,
            screen.componentViews[0]!.instances[0],
          ],
        }),
    ],
    [
      "order gap",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!.instances[0]!, { order: 99 }),
    ],
    [
      "orphan range",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!.ranges[0]!, {
          target: { kind: "instance", instanceKey: "a".repeat(64) },
        }),
    ],
    [
      "range cycle",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!.ranges[0]!, {
          parentId: "r-0",
        }),
    ],
    [
      "missing empty range",
      (_v, screen) => Object.assign(screen.componentViews[0]!, { ranges: [] }),
    ],
    [
      "foreign slot owner",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!.slots[0]!, {
          owner: { kind: "instance", instanceKey: "a".repeat(64) },
        }),
    ],
    [
      "slot cycle",
      (_v, screen) => {
        const slot = screen.componentViews[0]!.slots[0]!;
        Object.assign(slot, { sourceSlotKey: slot.key });
      },
    ],
    [
      "stored variant fragments",
      (_v, _s, _component, variant) =>
        Object.assign(variant, {
          fragments: { mobile: "../source.html", desktop: "source.html" },
        }),
    ],
    [
      "invalid variant schemes",
      (_v, _s, _component, variant) =>
        Object.assign(variant, { colorSchemes: ["dark"] }),
    ],
    [
      "bad saved props",
      (_v, _s, _component, variant) =>
        Object.assign(variant, {
          props: { label: ["number", "2"] },
        }),
    ],
    [
      "unknown style owner",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!, {
          styles: [
            { startOffset: 10, endOffset: 20, componentIds: ["unknown"] },
          ],
        }),
    ],
    [
      "unsafe resource",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!, {
          resources: [{ path: "../secret", componentIds: ["action"] }],
        }),
    ],
  ];
  for (const [name, edit] of edits) {
    const value = structuredClone(original);
    const screen = value.entries.find(
      (entry): entry is ComponentManifestScreen =>
        entry.kind === "screen" && entry.componentViews !== undefined,
    )!;
    const component = value.entries.find(
      (entry): entry is ManifestComponent =>
        entry.kind === "component" && !("variantOf" in entry),
    )!;
    const variant = value.entries.find(
      (entry): entry is ManifestComponentVariant =>
        entry.kind === "component" && "variantOf" in entry,
    )!;
    edit(value, screen, component, variant);
    assert.throws(() => parseManifest(value), Error, name);
  }
});

test("historical reader still rejects removed fields on current v8 manifests", async (context) => {
  const original = await example(context);
  for (const field of [
    "dependencies",
    "declaredDependencies",
    "ownedDependencies",
  ] as const) {
    const invalid = structuredClone(original);
    const entry = invalid.entries.find((candidate) =>
      field === "ownedDependencies"
        ? candidate.kind === "component"
        : candidate.kind === "screen",
    );
    assert.ok(entry);
    Object.assign(entry, { [field]: [] });
    assert.throws(() => parseHistoricalManifest(invalid), new RegExp(field));
  }
});
