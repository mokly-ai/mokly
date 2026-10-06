import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";
import {
  ComponentValidationError,
  encodeProps,
  reviewMaterialKey,
  slotKey,
} from "../packages/viewer/dist/data.js";
import type { ManifestScreen } from "../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("historical v8 null view records fail with typed plain-object validation", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  const original = (await compileCatalogue(await loadConfig(fixture.root)))
    .manifest;
  for (const kind of ["screen", "variant"] as const) {
    const value = structuredClone(original);
    const entry = value.entries.find((entry) =>
      kind === "screen"
        ? entry.kind === "screen"
        : entry.kind === "component" && "variantOf" in entry,
    )!;
    assert.ok("componentViews" in entry);
    Object.assign(entry.componentViews!, { 0: null });
    assert.throws(
      () => parseHistoricalManifest(value),
      (error) => {
        assert.ok(error instanceof ComponentValidationError);
        assert.equal(error.detail, "expected a plain object");
        return true;
      },
    );
  }
});

test("historical v8 retirement keeps instance props and slot validation strict", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  const original = (await compileCatalogue(await loadConfig(fixture.root)))
    .manifest;
  for (const mutation of ["props", "slot"] as const) {
    const value = structuredClone(original);
    const screen = value.entries.find(
      (entry): entry is ManifestScreen => entry.kind === "screen",
    )!;
    const usage = screen.componentViews![0]!;
    Object.assign(usage, { styles: [null], resources: [42] });
    if (mutation === "props") {
      const instance = usage.instances.find(
        (item) => item.componentId === "action",
      )!;
      const invalidProps = { label: 42 };
      instance.props = encodeProps(invalidProps);
      instance.propsKey = reviewMaterialKey(invalidProps);
    } else {
      const receiver = usage.instances.find(
        (item) => item.componentId === "action",
      )!;
      usage.slots = [
        ...usage.slots,
        {
          key: slotKey(receiver.key, "undeclared"),
          instanceKey: receiver.key,
          name: "undeclared",
          owner: receiver.owner,
        },
      ].sort((left, right) => (left.key < right.key ? -1 : 1));
    }
    await context.test(mutation, () => {
      assert.throws(
        () => parseHistoricalManifest(value),
        mutation === "props" ? /string does not satisfy/ : /declared slot/,
      );
    });
  }
});

test("v8 retirement accepts baseline arrays on screens and variant entries only", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  const original = (await compileCatalogue(await loadConfig(fixture.root)))
    .manifest;
  const baseline = structuredClone(original);
  for (const entry of baseline.entries)
    if ("componentViews" in entry)
      for (const usage of entry.componentViews ?? [])
        Object.assign(usage, { styles: [{ obsolete: true }], resources: [42] });
  assert.throws(
    () => parseManifest(structuredClone(baseline)),
    /unknown field/,
  );
  const normalized = parseHistoricalManifest(baseline);
  assert.deepEqual(normalized, original);
  for (const field of ["styles", "resources"] as const) {
    const malformed = structuredClone(original);
    const variant = malformed.entries.find(
      (entry) => entry.kind === "component" && "variantOf" in entry,
    )!;
    assert.ok("componentViews" in variant);
    Object.assign(variant.componentViews[0]!, { [field]: null });
    assert.throws(() => parseHistoricalManifest(malformed), /must be an array/);
  }
});
