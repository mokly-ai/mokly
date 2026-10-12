import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { classifyComponentsWithSources } from "../dist/review/component_classification_sources.js";
import {
  CssAttribution,
  type CollectedCssRule,
} from "../dist/review/css/attribution.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import { reviewViews as generatedViews } from "../dist/review/views.js";

import {
  designLibraryFixture,
  snapshotReader,
} from "./helpers/design_library_fixture.js";
import { fingerprintProofProjection } from "./helpers/fingerprint_proof_projection.mjs";
import { fingerprintReplayReader } from "./helpers/fingerprint_replay_reader.mjs";

test("replay projection compares range records across collection orders", () => {
  const first = {
    ruleKey: "rule",
    status: "matched",
    selectors: [".x"],
    matches: [
      {
        selector: ".x",
        root: "action",
        nested: [],
        components: ["action"],
        occurrences: [
          {
            rangeId: "r-0",
            componentId: "action",
            root: true,
            start: 40,
            end: 60,
          },
        ],
      },
    ],
  } satisfies CollectedCssRule;
  const second = structuredClone(first);
  second.matches[0]!.occurrences[0]!.start = 80;
  second.matches[0]!.occurrences[0]!.end = 120;
  const proof = (rules: CollectedCssRule[]) => {
    const cssProof = new CssAttribution();
    for (const rule of rules) cssProof.record([rule]);
    cssProof.freeze();
    return fingerprintProofProjection({
      result: { changes: [], screens: [], components: [] },
      sources: { cssProof },
    });
  };
  assert.deepEqual(proof([first, second]), proof([second, first]));
});

test("screen-header replay keeps equal range sets in original page coordinates", async (t) => {
  const fixture = await designLibraryFixture(t);
  const changed = "examples/basic/design-library/chrome/screen-header.css";
  await fixture.edit(
    changed,
    (source) => source + "\n.mbk-screen-head { outline-width: 3px; }\n",
  );
  const current = new Map(fixture.resources);
  current.set(
    changed.slice("examples/basic/".length),
    await fs.readFile(path.join(fixture.root, changed), "utf8"),
  );
  const base = fingerprintReplayReader(
    snapshotReader(fixture.before, fixture.resources),
  );
  const head = fingerprintReplayReader(snapshotReader(fixture.before, current));
  const input = {
    before: fixture.before.manifest,
    after: fixture.before.manifest,
    config: fixture.config,
    changedPaths: [changed],
    baseCommit: "a".repeat(40),
    baseRef: "main",
  };
  const original = await classifyComponentsWithSources({
    ...input,
    beforeReader: base.observed,
    afterReader: head.observed,
  });
  const expectedRanges = new Set<string>();
  const root = "design/library/chrome/screen-header";
  for (const entry of fixture.before.manifest.entries)
    if (
      entry.kind === "component" &&
      "variantOf" in entry &&
      entry.variantOf === root
    )
      for (const view of generatedViews(entry)) {
        const html = Buffer.from(
          await base.observed.read(view.path),
        ).toString();
        const analysis = new PageAnalysis(html, view.path, view.usage);
        const range = analysis.ranges.find(
          (range) => range.record.target.kind === "root",
        )!;
        assert.ok(html.slice(0, range.contentStart).includes("<link"));
        assert.ok(
          html
            .slice(range.contentStart, range.contentEnd)
            .includes("mbk-screen-head"),
        );
        expectedRanges.add(`${range.contentStart}:${range.contentEnd}`);
      }
  assert.ok(expectedRanges.size > 1);
  const assertRanges = (value: typeof original) => {
    const proof = value.sources.cssProof as unknown as {
      all: CollectedCssRule[];
    };
    const roots = proof.all.flatMap((rule) =>
      rule.matches.flatMap((match) =>
        match.occurrences.filter(
          (range) => range.root && range.componentId === root,
        ),
      ),
    );
    assert.ok(roots.length > 0);
    for (const range of roots)
      assert.ok(
        expectedRanges.has(`${range.start}:${range.end}`),
        "proof uses original UTF-16 component boundaries",
      );
  };
  assertRanges(original);
  const results = [];
  for (const useMaterialFingerprints of [true, false]) {
    const result = await classifyComponentsWithSources({
      ...input,
      beforeReader: base.replay,
      afterReader: head.replay,
      useFastPath: false,
      useStylePath: false,
      useMaterialFingerprints,
    });
    assertRanges(result);
    results.push(fingerprintProofProjection(result));
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], fingerprintProofProjection(original));
});
