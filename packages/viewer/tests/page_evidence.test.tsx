import assert from "node:assert/strict";
import { test } from "node:test";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { ShellMain } from "../src/shell/views.js";

import {
  detailFixture,
  indexFixture,
  shellModelFixture,
} from "./catalogue_v9_fixture.js";
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
import { standaloneMarkup, storeMarkup } from "./shell_markup.js";

const { model: fixture } = componentWorkspaceFixture();
const CHANGED_PAGE = {
  changes: { status: "ready", kind: "changed", included: true },
} as const;

test("a changed document shows its status and each stylesheet once in the right panel", () => {
  const markup = renderPage(createCatalogue(published(CHANGED_PAGE, CHANGED)));
  // The entry bar, the section on the canvas and Inspect's head in the right
  // panel each name the page.
  assert.deepEqual(status(markup), ["Changed", "Changed", "Changed"]);
  assert.equal(markup.split(CHANGED_SECTION).length, 2, markup);
  assert.doesNotMatch(
    markup,
    /Changed component|Shared component changes|this screen|saved view|this variant|1{64}/,
  );
  assert.doesNotMatch(
    markup,
    /data-diff-screen|data-viewport-option|mbk-stage-heading/,
  );
});

test("an unchanged document lists examined stylesheets, then its terminal line", () => {
  const markup = renderPage(createCatalogue(fixture));
  assert.deepEqual(status(markup), ["Unmodified", "Unmodified", "Unmodified"]);
  assert.equal(
    section(markup),
    '<section class="mbk-comparison-evidence mbk-reset" data-page-evidence="">' +
      '<h3 class="mbk-reset">Comparison details</h3>' +
      `<p class="mbk-reset">Compared with the branch point on ${BASE}.</p>` +
      '<p class="mbk-reset">This stylesheet changed, but none of the changed styles apply to this page.</p>' +
      '<p class="mbk-reset">Examined and excluded:</p><ul class="mbk-reset"><li class="mbk-reset">mockups/page.css</li></ul>' +
      '<p class="mbk-reset">No changes to this page.</p></section>',
  );
});

test("an added document shows Added without a terminal line", () => {
  const markup = renderPage(
    createCatalogue(
      published({
        changes: { status: "ready", kind: "added", included: true },
      }),
    ),
  );
  assert.deepEqual(status(markup), ["Added", "Added", "Added"]);
  assert.equal(
    section(markup),
    '<section class="mbk-comparison-evidence mbk-reset" data-page-evidence="">' +
      `<h3 class="mbk-reset">Comparison details</h3><p class="mbk-reset">Compared with the branch point on ${BASE}.</p></section>`,
  );
});

test("Changes that are not ready show no page status or comparison details", () => {
  const { resourceEvidence: _evidence, ...guide } = detailFixture({
    path: "guide",
  });
  for (const changesStatus of ["pending", "unavailable", "disabled"] as const) {
    const index = indexFixture((model) => {
      delete model.baseCommit;
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
      createCatalogue(
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
  const catalogue = createCatalogue(fixture);
  const removed = catalogue.removedEntries.find(
    ({ entry }) => entry.path === "product/removed-page",
  );
  assert.ok(removed?.entry.kind === "page");
  const markup = storeMarkup(
    <ShellMain
      catalogue={catalogue}
      context={{ base: BASE }}
      view={{ kind: "target", target: { entry: removed.entry, kind: "entry" } }}
    />,
  );
  assert.deepEqual(status(markup), ["Removed", "Removed"]);
  assert.equal(section(markup), undefined);
});

test("the standalone shell renders the page evidence of the held detail in the Changes tab, without the branch-point sentence", () => {
  const html = standaloneMarkup({
    index: publishedIndex(CHANGED_PAGE),
    details: publishedDetails(CHANGED, CHANGED_REASONS),
    path: "/view/guide/",
  });
  assert.deepEqual(status(html), ["Changed", "Changed", "Changed"]);
  // The Changes filter lists the page, so its Changes tab holds the
  // evidence, and the Compared rail names the branch point in its place.
  const sentence = `<p class="mbk-reset">Compared with the branch point on ${BASE}.</p>`;
  assert.equal(html.split(CHANGED_SECTION.replace(sentence, "")).length, 2);
});
