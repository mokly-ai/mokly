import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import type { ShellContext } from "../src/shell/context.js";
import { renderHydratedShellPage } from "../src/shell/document.js";
import { workspaceData } from "../src/shell/workspace_data.js";
import {
  viewerCatalogue,
  viewerContext,
  viewerView,
} from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

/** The branch name that the export recorded from its comparison. */
const BASE = "origin/main";
const DEPLOYMENT = "d".repeat(64);
const HEADING =
  "<h3>Comparison details</h3>" +
  `<p>Compared with the branch point on ${BASE}.</p>`;

const model: CatalogueReadModel = {
  ...componentWorkspaceFixture().model,
  deploymentId: DEPLOYMENT,
};

/** The published fixture's screen, saved component view and document page. */
const ENTRIES = [
  ["screen", "product/browse/details", "workspace"],
  ["saved component view", "components/action/default", "workspace"],
  ["document page", "guide", "page"],
] as const;

/** The context that an export renders one route with, once Changes are ready. */
function exportContext(screenPath: string): ShellContext {
  return {
    activeId: screenPath,
    base: BASE,
    changedEntries: [],
    changesStatus: "ready",
    delivery: {
      schemaVersion: 5,
      deploymentId: DEPLOYMENT,
      canonicalPath: `/view/${screenPath}/`,
      comparisonUrl: null,
    },
    readModel: model,
    updateVersion: 0,
  };
}

/**
 * One exported route. Without the private catalogue the route has no inert
 * workspace, so the shell shows the temporary view built from public data,
 * as it does after client navigation until the destination's data loads.
 */
function exported(screenPath: string, loaded: boolean): string {
  const display = viewerCatalogue(model);
  const { publicModel: _public, ...privateCatalogue } = display;
  const view = viewerView(display, { ...defaultSelection, screenPath });
  return renderHydratedShellPage(
    view,
    exportContext(screenPath),
    loaded ? privateCatalogue : undefined,
  ).replaceAll("<!-- -->", "");
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

test("the public-data fallback keeps the name an export or Serve knows, and an embedded one stays nameless", () => {
  const catalogue = viewerCatalogue(model);
  const served: ShellContext = { base: BASE, updateVersion: 1 };
  for (const [, screenPath, evidence] of ENTRIES) {
    if (evidence !== "workspace") continue;
    const view = viewerView(catalogue, { ...defaultSelection, screenPath });
    if (view.kind !== "target" || view.target.kind !== "entry")
      throw new Error(`Missing fixture route ${screenPath}`);
    const entry = view.target.entry;
    if (entry.kind !== "screen" && entry.kind !== "component")
      throw new Error(`Unexpected fixture entry ${screenPath}`);
    for (const context of [exportContext(screenPath), served])
      assert.equal(workspaceData(catalogue, context, entry).base, BASE);
    const embedded = viewerContext(model, { ...defaultSelection, screenPath });
    assert.equal(embedded.base, "");
    assert.equal(workspaceData(catalogue, embedded, entry).base, "");
  }
});
