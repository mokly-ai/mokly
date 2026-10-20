import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { ComparisonHeading } from "../src/shell/evidence_details.js";

import { indexFixture, rawIndexFixture } from "./catalogue_v7_fixture.js";
import {
  CHANGED,
  CHANGED_REASONS,
  CHANGED_SECTION,
  publishedDetails,
  publishedIndex,
} from "./page_evidence_fixture.js";
import { embeddedMarkup } from "./presentation_v7_helpers.js";
import { standaloneMarkup } from "./shell_markup.js";

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

/** The fixture index without a base ref: no delivery knows a branch name. */
function nameless(): CatalogueReadModel {
  const index = rawIndexFixture();
  delete index.base;
  return index;
}

/** Render one entry as an embedding host does, from the index alone. */
function embedded(index: CatalogueReadModel, screenPath: string): string {
  return embeddedMarkup({ index, defaultSelection: { screenPath } }).replaceAll(
    "<!-- -->",
    "",
  );
}

/** The comparison details in Details, or undefined when none render. */
const section = (markup: string) =>
  /<section class="mbk-comparison-evidence" data-(?:workspace|page)-evidence="">.*?<\/section>/.exec(
    markup,
  )?.[0];

for (const entry of ENTRIES)
  test(`a ${entry.kind} of an index without a base keeps its Details without the branch-point sentence`, () => {
    const index = indexFixture((model) => {
      delete model.base;
    });
    assert.equal(
      section(standaloneMarkup({ index, path: `/view/${entry.id}/` })),
      `<section class="mbk-comparison-evidence" ${entry.evidence}="">` +
        `${HEADING}${entry.rest}</section>`,
    );
  });

test("a changed page of an index without a base keeps each file and style without the sentence", () => {
  const sentence = "<p>Compared with the branch point on origin/main.</p>";
  assert.ok(CHANGED_SECTION.includes(sentence));
  const html = standaloneMarkup({
    index: publishedIndex(
      { changes: { status: "ready", kind: "changed", included: true } },
      null,
    ),
    details: publishedDetails(CHANGED, CHANGED_REASONS),
    path: "/view/guide/",
  });
  assert.equal(section(html), CHANGED_SECTION.replace(sentence, ""));
});

for (const entry of ENTRIES)
  test(`a standalone ${entry.kind} names the index's branch point after the heading`, () => {
    const details = section(standaloneMarkup({ path: `/view/${entry.id}/` }));
    assert.ok(details);
    assert.ok(
      details.startsWith(
        `<section class="mbk-comparison-evidence" ${entry.evidence}="">` +
          `${HEADING}<p>Compared with the branch point on main.</p>`,
      ),
      details,
    );
  });

test("an embedded entry names the branch point exactly when its index has a base", () => {
  for (const entry of ENTRIES) {
    const opening = `<section class="mbk-comparison-evidence" ${entry.evidence}="">${HEADING}`;
    const named = section(embedded(rawIndexFixture(), entry.id));
    const unnamed = section(embedded(nameless(), entry.id));
    assert.ok(named && unnamed);
    assert.ok(
      named.startsWith(
        `${opening}<p>Compared with the branch point on main.</p>`,
      ),
      named,
    );
    assert.ok(unnamed.startsWith(opening), unnamed);
    assert.doesNotMatch(unnamed, /Compared with the branch point/);
  }
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
