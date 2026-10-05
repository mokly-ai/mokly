import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { renderHydratedShellPage } from "../src/shell/document.js";
import { ComparisonHeading } from "../src/shell/evidence_details.js";
import { viewerCatalogue, viewerView } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";
import { renderViewer } from "../src/viewer/server.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";
import {
  BASE,
  CHANGED,
  CHANGED_SECTION,
  published,
} from "./page_evidence_fixture.js";

const { model } = componentWorkspaceFixture();

const HEADING = "<h3>Comparison details</h3>";

/**
 * The published fixture's screen, saved component view and document page,
 * with the Details that each shows after the shared heading.
 */
const ENTRIES = [
  {
    kind: "screen",
    id: "product/browse/details",
    evidence: "data-workspace-evidence",
    rest:
      '<p>The previous version is at <code class="mbk-code">product/details</code>, where it was before the move.</p>' +
      "<p>This stylesheet changed, but none of the changed styles apply to this screen.</p>" +
      "<p>Examined and excluded:</p><ul><li>mockups/action.css</li></ul>" +
      "<p>No changes to this screen.</p>",
  },
  {
    kind: "saved component view",
    id: "components/action/default",
    evidence: "data-workspace-evidence",
    rest:
      "<p>This stylesheet changed, but none of the changed styles apply to this variant.</p>" +
      "<p>Examined and excluded:</p><ul><li>mockups/action.css</li></ul>" +
      "<p>No changes to this saved view.</p>",
  },
  {
    kind: "document page",
    id: "guide",
    evidence: "data-page-evidence",
    rest:
      "<p>This stylesheet changed, but none of the changed styles apply to this page.</p>" +
      "<p>Examined and excluded:</p><ul><li>mockups/page.css</li></ul>" +
      "<p>No changes to this page.</p>",
  },
] as const;

/** Render one entry as an embedding host does, from the public catalogue alone. */
function embedded(catalogue: CatalogueReadModel, screenPath: string): string {
  return renderViewer({
    viewerId: "embedded",
    catalogue,
    baseUrl: "https://host.example/catalogue/",
    defaultSelection: { screenPath },
  }).replaceAll("<!-- -->", "");
}

/** Render one entry as Serve and export do, with a known name and private data. */
function served(screenPath: string): string {
  const { publicModel: _public, ...catalogue } = viewerCatalogue(model);
  return renderHydratedShellPage(
    viewerView(viewerCatalogue(model), { ...defaultSelection, screenPath }),
    {
      activeId: screenPath,
      base: "main",
      changedEntries: [],
      changesStatus: "ready",
      readModel: model,
      updateVersion: 1,
    },
    catalogue,
  ).replaceAll("<!-- -->", "");
}

/** The comparison details in Details, or undefined when none render. */
const section = (markup: string) =>
  /<section class="mbk-comparison-evidence" data-(?:workspace|page)-evidence="">.*?<\/section>/.exec(
    markup,
  )?.[0];

for (const entry of ENTRIES)
  test(`an embedded ${entry.kind} keeps its Details without the branch-point sentence`, () => {
    assert.equal(
      section(embedded(model, entry.id)),
      `<section class="mbk-comparison-evidence" ${entry.evidence}="">` +
        `${HEADING}${entry.rest}</section>`,
    );
  });

test("an embedded changed page keeps each file and style without the sentence", () => {
  const sentence = `<p>Compared with the branch point on ${BASE}.</p>`;
  assert.ok(CHANGED_SECTION.includes(sentence));
  const catalogue = published({
    changes: { status: "ready", kind: "changed", included: true },
    resourceEvidence: CHANGED,
  });
  assert.equal(
    section(embedded(catalogue, "guide")),
    CHANGED_SECTION.replace(sentence, ""),
  );
});

for (const entry of ENTRIES)
  test(`a served ${entry.kind} names the known branch point after the heading`, () => {
    const details = section(served(entry.id));
    assert.ok(details);
    assert.ok(
      details.startsWith(
        `<section class="mbk-comparison-evidence" ${entry.evidence}="">` +
          `${HEADING}<p>Compared with the branch point on main.</p>`,
      ),
      details,
    );
  });

test("the shared heading names only a known branch point", () => {
  for (const base of ["", " "])
    assert.equal(
      renderToStaticMarkup(<ComparisonHeading base={base} />),
      HEADING,
    );
  assert.equal(
    renderToStaticMarkup(<ComparisonHeading base="origin/main" />),
    `${HEADING}<p>Compared with the branch point on origin/main.</p>`,
  );
});
