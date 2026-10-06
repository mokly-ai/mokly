import assert from "node:assert/strict";

import {
  referencedRoutes,
  referenceRoutes,
} from "../../dist/review/asset_references.js";
import { prepareComponentProjection } from "../../dist/review/component_projection_resources.js";
import { generatedViews } from "../../packages/viewer/dist/components/views.js";

import type { FastPathFixture } from "./component_fast_path.js";
import { comparePageViews, pageContext } from "./page_comparison.js";
import { prepareComponentProjection as delivered } from "./page_m6/component_projection_resources.js";

export async function assertPageMaterialEquivalence(fixture: FastPathFixture) {
  const context = pageContext(fixture, true, "page_m6");
  const oldContext = pageContext(fixture, false, "page_m6");
  for (const entry of fixture.after.entries) {
    const previous = fixture.before.entries.find(
      ({ path: id }) => id === entry.path,
    )!;
    const root = "variantOf" in entry ? entry.variantOf : undefined;
    for (const after of generatedViews(entry)) {
      const before = generatedViews(previous).find(
        ({ path }) => path === after.path,
      )!;
      const base = await context.beforeReader.text(before.path);
      const head = await context.afterReader.text(after.path);
      const current = prepareComponentProjection(
        { ...context, useMaterialFingerprints: false },
        before,
        after,
        base,
        head,
        root,
      );
      const old = delivered(oldContext, before, after, base, head, root);
      const fingerprints = prepareComponentProjection(
        context,
        before,
        after,
        base,
        head,
        root,
      );
      assert.deepEqual(
        fingerprints.references,
        current.references,
        `${after.path}: fingerprint seeds`,
      );
      assert.deepEqual(
        fingerprints.ownedComponentIds,
        current.ownedComponentIds,
        `${after.path}: fingerprint owners`,
      );
      assert.deepEqual(
        fingerprints.inlineEvidence,
        current.inlineEvidence,
        `${after.path}: fingerprint evidence`,
      );
      assert.deepEqual(
        current.projected,
        old.projected,
        `${entry.path}/${after.path}: text materials`,
      );
      assert.ok(current.references);
      for (const side of ["before", "after"] as const)
        for (const actual of [false, true]) {
          const html = actual
            ? old.projected.actual[side === "before" ? "base" : "head"]
            : old.projected[side];
          const references: readonly string[] = actual
            ? current.references[
                side === "before" ? "actualBefore" : "actualAfter"
              ]
            : current.references[side];
          const route = side === "before" ? before.path : after.path;
          const reader =
            side === "before" ? context.beforeReader : context.afterReader;
          const oldReader =
            side === "before"
              ? oldContext.beforeReader
              : oldContext.afterReader;
          const excluded = actual ? undefined : current.excluded;
          const oldExcluded = actual ? undefined : old.excluded;
          assert.deepEqual(
            referenceRoutes(route, references),
            referencedRoutes(route, html, { resourceHints: false }),
            `${after.path}: ${side}/${actual} seeds`,
          );
          assert.deepEqual(
            await reader.resources(route, html, excluded, references),
            await oldReader.resources(route, html, oldExcluded),
            `${after.path}: ${side}/${actual} closure`,
          );
        }
    }
  }
  const publicResults = (
    results: Awaited<ReturnType<typeof comparePageViews>>,
  ) =>
    results.map(
      ({
        comparison: { view, reasons, changedImplementations, ownedResources },
        ...scope
      }) => ({
        ...scope,
        view,
        reasons,
        changedImplementations,
        ownedResources,
      }),
    );
  assert.deepEqual(
    publicResults(
      await comparePageViews(fixture, false, true, true, "page_m6"),
    ),
    publicResults(await comparePageViews(fixture, true)),
    "public comparison results equal M6",
  );
  assert.deepEqual(
    await comparePageViews(fixture, false, false, true),
    await comparePageViews(fixture, false, false, false),
    "every complete view equals the M8 text-material oracle",
  );
}
