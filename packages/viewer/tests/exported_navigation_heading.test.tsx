import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { workspaceData } from "../src/shell/workspace_data.js";
import {
  viewerCatalogue,
  viewerContext,
  viewerView,
} from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import { indexFixture, shellModelFixture } from "./catalogue_v8_fixture.js";
import { standaloneMarkup } from "./shell_markup.js";

/** The branch name that the export recorded from its comparison. */
const BASE = "origin/main";
const HEADING =
  "<h3>Comparison details</h3>" +
  `<p>Compared with the branch point on ${BASE}.</p>`;

/** The exported index, which carries the base ref of its comparison. */
const named = (): CatalogueReadModel =>
  indexFixture((index) => {
    index.base = BASE;
  });

/** The published fixture's screen, saved component view and document page. */
const ENTRIES = [
  ["screen", "product/browse/details", "workspace"],
  ["saved component view", "components/action/default", "workspace"],
  ["document page", "guide", "page"],
] as const;

/**
 * One exported route. Before the entry's detail arrives, the shell shows the
 * temporary view built from the index, as it does after client navigation
 * until the destination's detail loads.
 */
function exported(screenPath: string, loaded: boolean): string {
  return standaloneMarkup({
    index: named(),
    ...(loaded ? {} : { details: [] }),
    path: `/view/${screenPath}/`,
  });
}

/** The comparison details in Details, or undefined when none render. */
const section = (markup: string) =>
  /<section class="mbk-comparison-evidence" data-(?:workspace|page)-evidence="">.*?<\/section>/.exec(
    markup,
  )?.[0];

for (const [kind, screenPath, evidence] of ENTRIES)
  test(`an exported ${kind} names the known branch point before and after its data loads`, () => {
    const opening =
      `<section class="mbk-comparison-evidence" data-${evidence}-evidence="">` +
      HEADING;
    const temporary = section(exported(screenPath, false));
    const loaded = section(exported(screenPath, true));
    assert.ok(temporary);
    assert.ok(loaded);
    assert.ok(temporary.startsWith(opening), temporary);
    assert.ok(loaded.startsWith(opening), loaded);
  });

test("the index fallback keeps the index's base in every delivery, and an index without one stays nameless", () => {
  const nameless = indexFixture((index) => {
    delete index.base;
  });
  for (const [index, base] of [
    [named(), BASE],
    [nameless, ""],
  ] as const) {
    // The temporary workspace of a route whose detail has not arrived.
    const model = shellModelFixture(index, new Map());
    const catalogue = viewerCatalogue(model);
    for (const [, screenPath, evidence] of ENTRIES) {
      if (evidence !== "workspace") continue;
      const selection = { ...defaultSelection, screenPath };
      const view = viewerView(catalogue, selection);
      if (view.kind !== "target" || view.target.kind !== "entry")
        throw new Error(`Missing fixture route ${screenPath}`);
      const entry = view.target.entry;
      if (entry.kind !== "screen" && entry.kind !== "component")
        throw new Error(`Unexpected fixture entry ${screenPath}`);
      const embedded = viewerContext(model, selection);
      for (const context of [embedded, { ...embedded, embedded: false }])
        assert.equal(workspaceData(catalogue, context, entry).base, base);
    }
  }
});
