import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { ShellMain } from "../src/shell/views.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

import {
  detailFixture,
  indexFixture,
  shellModelFixture,
} from "./catalogue_v7_fixture.js";
import { componentWorkspaceFixture } from "./component_workspace_fixture.js";
import {
  BASE,
  CHANGED,
  CHANGED_REASONS,
  CHANGED_SECTION,
  published,
  publishedDetails,
  publishedIndex,
  renderPage,
  section,
  status,
} from "./page_evidence_fixture.js";
import { standaloneMarkup } from "./shell_markup.js";

const { model: fixture } = componentWorkspaceFixture();
const CHANGED_PAGE = {
  changes: { status: "ready", kind: "changed", included: true },
} as const;

test("a changed document shows its status and each stylesheet once in Details", () => {
  const markup = renderPage(viewerCatalogue(published(CHANGED_PAGE, CHANGED)));
  assert.deepEqual(status(markup), ["Changed"]);
  assert.ok(markup.includes(`${CHANGED_SECTION}</details>`), markup);
  assert.doesNotMatch(
    markup,
    /Changed component|Shared component changes|this screen|saved view|1{64}/,
  );
  assert.doesNotMatch(
    markup,
    /data-diff-screen|data-viewport-option|mbk-stage-heading/,
  );
});

test("an unchanged document lists examined stylesheets, then its terminal line", () => {
  const markup = renderPage(viewerCatalogue(fixture));
  assert.deepEqual(status(markup), ["Unmodified"]);
  assert.equal(
    section(markup),
    '<section class="mbk-comparison-evidence" data-page-evidence="">' +
      "<h3>Comparison details</h3>" +
      `<p>Compared with the branch point on ${BASE}.</p>` +
      "<p>This stylesheet changed, but none of the changed styles apply to this page.</p>" +
      "<p>Examined and excluded:</p><ul><li>mockups/page.css</li></ul>" +
      "<p>No changes to this page.</p></section>",
  );
});

test("an added document shows Added without a terminal line", () => {
  const markup = renderPage(
    viewerCatalogue(
      published({
        changes: { status: "ready", kind: "added", included: true },
      }),
    ),
  );
  assert.deepEqual(status(markup), ["Added"]);
  assert.equal(
    section(markup),
    '<section class="mbk-comparison-evidence" data-page-evidence="">' +
      `<h3>Comparison details</h3><p>Compared with the branch point on ${BASE}.</p></section>`,
  );
});

test("Changes that are not ready show no page status or comparison details", () => {
  const { resourceEvidence: _evidence, ...guide } = detailFixture({
    path: "guide",
  });
  for (const changesStatus of ["pending", "unavailable", "disabled"] as const) {
    const index = indexFixture((model) => {
      Object.assign(model, {
        changesStatus,
        comparisonUrl: null,
        screens: [],
        components: [],
        useCases: [],
        removedEntries: [],
        tree: [{ kind: "entry", path: "guide" }],
        documents: [],
        treeOrder: [],
      });
      model.pages = model.pages.map((page) => ({
        ...page,
        changes: { status: changesStatus },
      }));
    });
    const markup = renderPage(
      viewerCatalogue(
        shellModelFixture(
          index,
          new Map([[detailKey({ path: "guide" }), guide]]),
        ),
      ),
    );
    assert.deepEqual(status(markup), [], changesStatus);
    assert.equal(section(markup), undefined, changesStatus);
  }
});

test("a removed document keeps its Removed badge and no comparison details", () => {
  const catalogue = viewerCatalogue(fixture);
  const removed = catalogue.removedEntries.find(
    ({ entry }) => entry.path === "product/removed-page",
  );
  assert.ok(removed?.entry.kind === "page");
  const markup = renderToStaticMarkup(
    <ShellMain
      catalogue={catalogue}
      context={{ base: BASE }}
      view={{ kind: "target", target: { entry: removed.entry, kind: "entry" } }}
    />,
  );
  assert.deepEqual(status(markup), ["Removed"]);
  assert.equal(section(markup), undefined);
});

test("the standalone shell renders the page evidence of the held detail", () => {
  const html = standaloneMarkup({
    index: publishedIndex(CHANGED_PAGE),
    details: publishedDetails(CHANGED, CHANGED_REASONS),
    path: "/view/guide/",
  });
  assert.deepEqual(status(html), ["Changed"]);
  assert.ok(html.includes(`${CHANGED_SECTION}</details>`));
});
