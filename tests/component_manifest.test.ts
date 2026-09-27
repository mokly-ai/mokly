import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";
import type { ManifestComponent } from "../packages/viewer/dist/components/manifest_types.js";
import type {
  ManifestV5,
  ManifestScreenV4,
} from "../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

async function example(t: {
  after: (fn: () => Promise<void>) => void;
}): Promise<ManifestV5> {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const result = await compileCatalogue(await loadConfig(fixture.root));
  assert.equal(result.manifest.schemaVersion, 5);
  return result.manifest as ManifestV5;
}

test("manifest v5 rejects broken identities, ownership references and props before readers can suppress changes", async (t) => {
  const original = await example(t);
  const edits: readonly [
    string,
    (
      value: ManifestV5,
      screen: ManifestScreenV4,
      component: ManifestComponent,
    ) => void,
  ][] = [
    ["unknown schema", (value) => Object.assign(value, { schemaVersion: 6 })],
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
      "unsafe fragment",
      (_v, _s, component) =>
        Object.assign(component.variants[0]!.fragments, {
          mobile: "../source.html",
        }),
    ],
    [
      "noncanonical variant fragment",
      (_v, _s, component) =>
        Object.assign(component.variants[0]!.fragments, {
          mobile: "components/action.mobile.html",
        }),
    ],
    [
      "bad saved props",
      (_v, _s, component) =>
        Object.assign(component.variants[0]!, {
          props: { label: ["number", "2"] },
        }),
    ],
    [
      "retired current styles",
      (_v, screen) => Object.assign(screen.componentViews[0]!, { styles: [] }),
    ],
    [
      "retired current resources",
      (_v, screen) =>
        Object.assign(screen.componentViews[0]!, { resources: [] }),
    ],
  ];
  for (const [name, edit] of edits) {
    const value = structuredClone(original);
    const screen = value.entries.find(
      (entry): entry is ManifestScreenV4 => entry.kind === "screen",
    )!;
    const component = value.entries.find(
      (entry): entry is ManifestComponent => entry.kind === "component",
    )!;
    edit(value, screen, component);
    assert.throws(() => parseManifest(value), Error, name);
  }
});

test("historical v5 discards retired ownership arrays and rejects malformed values", async (t) => {
  const original = await example(t);
  const historical = structuredClone(original);
  const screen = historical.entries.find(
    (entry): entry is ManifestScreenV4 => entry.kind === "screen",
  )!;
  Object.assign(screen.componentViews[0]!, {
    styles: [{ malformed: true }],
    resources: [42],
  });
  const parsed = parseHistoricalManifest(historical);
  const parsedScreen = parsed.entries.find((entry) => entry.kind === "screen")!;
  assert.ok(parsedScreen.kind === "screen");
  assert.equal(
    Object.hasOwn(parsedScreen.componentViews![0]!, "styles"),
    false,
  );
  assert.equal(
    Object.hasOwn(parsedScreen.componentViews![0]!, "resources"),
    false,
  );

  for (const [field, value] of [
    ["styles", null],
    ["resources", {}],
  ] as const) {
    const invalid = structuredClone(original);
    const invalidScreen = invalid.entries.find(
      (entry): entry is ManifestScreenV4 => entry.kind === "screen",
    )!;
    Object.assign(invalidScreen.componentViews[0]!, { [field]: value });
    assert.throws(() => parseHistoricalManifest(invalid), /must be an array/);
  }
});
