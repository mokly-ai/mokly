import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";
import type {
  ComponentInputOwner,
  ComponentViewRecord,
} from "../packages/viewer/dist/components/manifest_types.js";
import type { ManifestV5 } from "../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const pageSource = `import { definePage } from "@mokly/mokly";
export const mockups = [definePage({ id: "handbook", title: "Handbook", description: "Document", dependencies: [], relatedDocs: [], route: "handbook.html", render: () => "<html><body>Handbook</body></html>" })];`;

test("the current manifest combines pages and complete component usage without legacy roots", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  await fs.writeFile(`${fixture.entriesDir}/handbook.mockup.ts`, pageSource);
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const current = parseManifest(compilation.manifest);
  assert.equal(current.schemaVersion, 5);
  assert.equal("legacyPages" in current, false);
  assert.ok(current.sourceFiles.includes("entries/handbook.mockup.ts"));
  assert.ok(current.entries.some((entry) => entry.kind === "page"));
  assert.ok(current.entries.some((entry) => entry.kind === "component"));
  const screen = current.entries.find((entry) => entry.kind === "screen");
  assert.ok(screen?.componentViews?.every((view) => view.instances.length > 0));
  assert.match(compilation.outputs.get("handbook.html") ?? "", /Handbook/);
});

test("historical component identities remain readable across domain cutovers", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const historical = remapComponentKeys(compilation.manifest);

  assert.equal(parseHistoricalManifest(historical).schemaVersion, 5);
  assert.throws(() => parseManifest(historical), /key mismatch/);
});

test("both disjoint historical v4 formats remain readable only at the Git boundary", async (context) => {
  const componentFixture = await createFixture(componentEntrySource());
  const pageFixture = await createFixture(pageSource);
  context.after(() => removeFixture(componentFixture));
  context.after(() => removeFixture(pageFixture));
  const components = (
    await compileCatalogue(await loadConfig(componentFixture.root))
  ).manifest;
  const pages = (await compileCatalogue(await loadConfig(pageFixture.root)))
    .manifest;
  const componentV4 = {
    schemaVersion: 4,
    generatedBy: "mokly",
    legacyPages: [],
    entries: components.entries,
  };
  const pageV4 = {
    ...pages,
    schemaVersion: 4,
    entries: pages.entries.map(
      ({ declaredDependencies: _declared, ...entry }) => entry,
    ),
  };
  for (const historical of [componentV4, pageV4]) {
    assert.equal(parseHistoricalManifest(historical).schemaVersion, 4);
    assert.throws(() => parseManifest(historical), /schema version 5/);
  }
  assert.throws(() =>
    parseHistoricalManifest({ ...componentV4, sourceFiles: [] }),
  );
  assert.throws(() => parseHistoricalManifest({ ...pageV4, legacyPages: [] }));
  const invalidUsage = structuredClone(componentV4);
  const screen = invalidUsage.entries.find((entry) => entry.kind === "screen");
  assert.ok(screen);
  Reflect.deleteProperty(screen, "componentViews");
  assert.throws(() => parseHistoricalManifest(invalidUsage));
});

function remapComponentKeys(manifest: ManifestV5): ManifestV5 {
  const result = structuredClone(manifest);
  const views = result.entries.flatMap((entry) =>
    entry.kind === "screen"
      ? (entry.componentViews ?? [])
      : entry.kind === "component"
        ? entry.variants.flatMap((variant) => variant.componentViews)
        : [],
  );
  for (const view of views) remapViewKeys(view);
  return result;
}

function remapViewKeys(view: ComponentViewRecord): void {
  const instanceKeys = new Map(
    view.instances.map((instance) => [instance.key, remapKey(instance.key)]),
  );
  const slotKeys = new Map(
    view.slots.map((slot) => [slot.key, remapKey(slot.key)]),
  );
  const owner = (value: ComponentInputOwner): ComponentInputOwner =>
    value.kind === "entry"
      ? value
      : { kind: "instance", instanceKey: instanceKeys.get(value.instanceKey)! };
  const instances = view.instances
    .map((instance) => ({
      ...instance,
      key: instanceKeys.get(instance.key)!,
      owner: owner(instance.owner),
      ...(instance.slotKey ? { slotKey: slotKeys.get(instance.slotKey)! } : {}),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const slots = view.slots
    .map((slot) => ({
      ...slot,
      instanceKey: instanceKeys.get(slot.instanceKey)!,
      key: slotKeys.get(slot.key)!,
      owner: owner(slot.owner),
      ...(slot.sourceSlotKey
        ? { sourceSlotKey: slotKeys.get(slot.sourceSlotKey)! }
        : {}),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const ranges = view.ranges.map((range) => ({
    ...range,
    target:
      range.target.kind === "instance"
        ? {
            kind: "instance" as const,
            instanceKey: instanceKeys.get(range.target.instanceKey)!,
          }
        : {
            kind: "slot" as const,
            slotKey: slotKeys.get(range.target.slotKey)!,
          },
  }));
  Object.assign(view, { instances, ranges, slots });
}

function remapKey(key: string): string {
  return [...key]
    .map((digit) => (15 - Number.parseInt(digit, 16)).toString(16))
    .join("");
}
