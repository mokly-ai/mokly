import assert from "node:assert/strict";
import test from "node:test";

import type {
  AffectedUsageEvidence,
  ComponentUsageContext,
  Manifest,
  ManifestScreen,
  ReviewResultV6,
} from "../packages/viewer/dist/data.js";

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
import { fixtureCssAnalysis } from "./helpers/css_evidence.js";

const chip = "library/chip";
const other = "library/other";
const bar = "library/bar";
const picker = "library/picker";
const chipSheet = "generated/chip.css";
const otherSheet = "generated/other.css";
const barContext: ComponentUsageContext = {
  kind: "component",
  entry: { path: bar, title: "Bar" },
  variantPath: `${bar}/selected`,
  viewport: "mobile",
  colorScheme: "light",
};
const screenContext: ComponentUsageContext = {
  kind: "screen",
  entry: { path: "screens/home", title: "Home" },
  viewport: "desktop",
  colorScheme: "light",
};

function evidence(
  context: ComponentUsageContext,
  chain: readonly string[],
  side: "before" | "after" = "after",
): AffectedUsageEvidence {
  return {
    side,
    context,
    via: chain.map((componentId, index) => ({
      componentId,
      instanceKey: `instance-${index}`,
    })),
  };
}

const result: ReviewResultV6 = {
  schemaVersion: 6,
  baseCommit: "a".repeat(40),
  baseRef: "main",
  changedPaths: [otherSheet, chipSheet],
  ignoredImpact: [],
  screens: [],
  components: [],
  changes: [
    {
      kind: "component",
      before: { path: other, title: "Other" },
      reasons: [{ kind: "dependency", path: otherSheet }],
    },
    {
      kind: "screen",
      after: { path: "screens/home", title: "Home" },
      reasons: [{ kind: "dependency", path: chipSheet }],
    },
    {
      kind: "component",
      before: { path: "library/old-chip", title: "Chip" },
      after: { path: chip, title: "Chip" },
      reasons: [
        {
          kind: "dependency",
          path: chipSheet,
          analysis: fixtureCssAnalysis("unresolved", ["body"]),
        },
        { kind: "metadata" },
      ],
    },
  ],
  affectedConsumers: [
    {
      changedComponentId: chip,
      consumer: { kind: "component", path: bar },
      evidence: [
        evidence(barContext, [bar, picker, chip]),
        evidence(barContext, [bar, picker, chip], "before"),
        evidence({ ...barContext, variantPath: `${bar}/default` }, [bar, chip]),
        evidence(screenContext, [bar, picker, chip]),
      ],
    },
    {
      changedComponentId: other,
      consumer: { kind: "component", path: bar },
      evidence: [
        evidence({ ...barContext, variantPath: `${bar}/other` }, [bar, other]),
      ],
    },
    {
      changedComponentId: other,
      consumer: { kind: "screen", path: "screens/unrelated" },
      evidence: [evidence(screenContext, [other])],
    },
    {
      changedComponentId: chip,
      consumer: { kind: "screen", path: "screens/second" },
      evidence: [evidence(screenContext, [chip])],
    },
    {
      changedComponentId: chip,
      consumer: { kind: "screen", path: "screens/home" },
      evidence: [evidence(screenContext, [chip])],
    },
  ],
};

test("change paths use current or removed sides without changing the result", () => {
  const snapshot = structuredClone(result);
  assert.deepEqual(changedEntryPaths(result), [chip, other, "screens/home"]);
  const [removed] = result.changes;
  assert.ok(removed);
  assert.deepEqual(
    changedEntryPaths({ ...result, changes: [...result.changes, removed] }),
    [chip, other, other, "screens/home"],
  );
  assert.deepEqual(result, snapshot);
  assert.throws(
    () =>
      changedEntryPaths({
        ...result,
        changes: [{ kind: "component", reasons: [] }],
      }),
    /must have a before or after side/,
  );
});

test("reasons retain exact dependency analysis and reject missing or duplicate entries", () => {
  assert.deepEqual(reasonsOf(result, chip), [
    {
      kind: "dependency",
      path: chipSheet,
      analysis: fixtureCssAnalysis("unresolved", ["body"]),
    },
    { kind: "metadata" },
  ]);
  assert.deepEqual(reasonsOf(result, other), [
    { kind: "dependency", path: otherSheet },
  ]);
  assert.throws(
    () => reasonsOf(result, "missing"),
    /Expected one changed entry/,
  );
  assert.throws(
    () =>
      reasonsOf(
        { ...result, changes: [...result.changes, ...result.changes] },
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
  assert.deepEqual(impactingIds({ ...result, affectedConsumers: [] }), []);
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

test("stylesheet scope uses only the exact dependency reason path", () => {
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
    schemaVersion: 9,
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
        props: {},
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
