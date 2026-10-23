import assert from "node:assert/strict";
import test from "node:test";

import type {
  Manifest,
  ManifestScreen,
} from "../packages/viewer/dist/registry/types.js";
import type { ReviewEntry } from "../packages/viewer/dist/review/types.js";

import {
  bar,
  chip,
  chipSheet,
  other,
  otherSheet,
  picker,
  removedOther,
  result,
} from "./helpers/attribution_fixture.js";
import {
  changedEntryPaths,
  impactingIds,
  manifestScreenConsumers,
  reasonsOf,
  screenConsumersOf,
  stylesheetScope,
  usageChainsOf,
  usageVariantsOf,
} from "./helpers/attribution_result.js";

test("change paths use current or removed sides without changing the result", () => {
  const snapshot = structuredClone(result);
  assert.deepEqual(changedEntryPaths(result), [chip, other, "screens/home"]);
  assert.deepEqual(
    changedEntryPaths({
      ...result,
      entries: [...result.entries, removedOther],
    }),
    [chip, other, other, "screens/home"],
  );
  assert.deepEqual(result, snapshot);
  const sideless: ReviewEntry = { ...removedOther };
  delete sideless.before;
  assert.throws(
    () => changedEntryPaths({ ...result, entries: [sideless] }),
    /must have a before or after side/,
  );
});

test("reasons are exact and reject missing or duplicate entries", () => {
  assert.deepEqual(reasonsOf(result, chip), [
    { kind: "dependency", path: chipSheet },
    { kind: "metadata" },
  ]);
  assert.deepEqual(reasonsOf(result, other), [
    { kind: "dependency", path: otherSheet },
    { kind: "removed" },
  ]);
  assert.throws(() => reasonsOf(result, bar), /Expected one changed entry/);
  assert.throws(
    () => reasonsOf(result, "missing"),
    /Expected one changed entry/,
  );
  assert.throws(
    () =>
      reasonsOf(
        { ...result, entries: [...result.entries, ...result.entries] },
        chip,
      ),
    /Expected one changed entry/,
  );
});

test("impact and screen consumers stay scoped to their changed component", () => {
  assert.deepEqual(impactingIds(result), [chip, other]);
  assert.deepEqual(screenConsumersOf(result, chip), [
    "screens/home",
    "screens/second",
  ]);
  assert.deepEqual(screenConsumersOf(result, other), ["screens/unrelated"]);
  assert.deepEqual(screenConsumersOf(result, "missing"), []);
  assert.deepEqual(impactingIds({ ...result, affected: [] }), []);
});

test("usage projections isolate owners and consumers and merge repeated sides", () => {
  assert.deepEqual(usageVariantsOf(result, chip, bar), [
    `${bar}/default`,
    `${bar}/selected`,
  ]);
  assert.deepEqual(usageVariantsOf(result, other, bar), [`${bar}/other`]);
  assert.deepEqual(usageVariantsOf(result, chip, "screens/home"), []);
  assert.deepEqual(usageChainsOf(result, chip, bar), [
    [bar, chip],
    [bar, picker, chip],
  ]);
  assert.deepEqual(usageChainsOf(result, other, bar), [[bar, other]]);
  assert.deepEqual(usageChainsOf(result, chip, "screens/home"), [[chip]]);
  assert.deepEqual(usageChainsOf(result, chip, "missing"), []);
});

test("stylesheet scope uses only the exact dependency reason route", () => {
  assert.deepEqual(stylesheetScope(result, chipSheet), [chip, "screens/home"]);
  assert.deepEqual(stylesheetScope(result, otherSheet), [other]);
  assert.deepEqual(stylesheetScope(result, "chip.css"), []);
});

function screen(path: string, componentIds: readonly string[]): ManifestScreen {
  return {
    kind: "screen",
    path,
    title: path,
    description: "Projection fixture",
    sourcePath: "fixture.mockup.tsx",
    relatedDocs: [],
    useCasePaths: [],
    colorSchemes: ["light"],
    componentViews: (["mobile", "desktop"] as const).map((viewport) => ({
      viewport,
      colorScheme: "light",
      instances: componentIds.map((componentId, order) => ({
        componentId,
        key: `instance-${order}`,
        id: `instance-${order}`,
        owner: { kind: "entry" },
        order,
        props: {},
        propsKey: "{}",
      })),
      slots: [],
      ranges: [],
      styles: [],
      resources: [],
    })),
  };
}

test("manifest consumers require real screen usage and count each screen once", () => {
  const manifest: Manifest = {
    generatedBy: "mokly",
    schemaVersion: 10,
    assetClosure: [],
    blobHashAlgorithm: "sha256",
    generatedFiles: [],
    sourceFiles: [],
    folders: [],
    entries: [
      screen("screens/second", [other, chip]),
      screen("screens/unrelated", [other]),
      screen("screens/home", [chip, chip]),
      { ...screen("screens/no-usage", []), componentViews: [] },
      {
        kind: "component",
        path: `${bar}/default`,
        title: "Bar",
        description: "Projection fixture",
        sourcePath: "bar.mockup.tsx",
        relatedDocs: [],
        colorSchemes: ["light"],
        variantOf: bar,
        propSchema: { type: "object", additionalProperties: false },
        props: {},
        controls: {},
        slots: [],
        suppliedSlots: [],
        componentViews: screen(`${bar}/default`, [chip]).componentViews ?? [],
      },
    ],
  };
  assert.deepEqual(manifestScreenConsumers(manifest, chip), [
    "screens/home",
    "screens/second",
  ]);
  assert.deepEqual(manifestScreenConsumers(manifest, other), [
    "screens/second",
    "screens/unrelated",
  ]);
  assert.deepEqual(manifestScreenConsumers(manifest, "missing"), []);
});
