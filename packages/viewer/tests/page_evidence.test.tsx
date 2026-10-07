import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { currentManifest } from "../../../tests/helpers/current_manifest.js";
import { readCatalogue } from "../src/catalogue/reader.js";
import type { ManifestPage, ManifestV9 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { renderHydratedShellPage } from "../src/shell/document.js";
import { ShellMain } from "../src/shell/views.js";
import { viewerCatalogue, viewerView } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";
import {
  BASE,
  CHANGED,
  CHANGED_SECTION,
  published,
  renderPage,
  section,
  status,
} from "./page_evidence_fixture.js";

const { model: fixture } = componentWorkspaceFixture();

test("a changed document shows its status and each stylesheet once in Details", () => {
  const markup = renderPage(
    viewerCatalogue(
      published({
        changes: { status: "ready", kind: "changed", included: true },
        resourceEvidence: CHANGED,
      }),
    ),
  );
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

test("live classification supplies the same page facts without a published catalogue", () => {
  const page = fixture.pages.find((item) => item.path === "guide");
  assert.ok(page);
  const entry: ManifestPage = {
    path: "guide",
    kind: "page",
    title: page.title,
    description: page.details.description,
    relatedDocs: [],
    sourcePath: page.details.sourcePath,
  };
  const manifest: ManifestV9 = currentManifest({
    folders: [],
    schemaVersion: 9,
    generatedBy: "mokly",
    sourceFiles: [entry.sourcePath],
    entries: [entry],
  });
  const live = (changedEntries: readonly string[], baseline = [entry]) =>
    renderPage(createCatalogue(manifest), {
      changedEntries,
      componentChanges: {
        baseline: { ...manifest, entries: baseline },
        pageEvidence: [{ path: "guide", ...CHANGED }],
      },
    });
  const changed = live(["guide"]);
  assert.deepEqual(status(changed), ["Changed"]);
  assert.equal(section(changed), CHANGED_SECTION);
  assert.deepEqual(status(live([], [])), ["Added"]);
  const unknown = renderPage(createCatalogue(manifest));
  assert.deepEqual(status(unknown), []);
  assert.equal(section(unknown), undefined);
});

test("Changes that are not ready show no page status or comparison details", () => {
  const guide = fixture.pages.find((item) => item.path === "guide");
  assert.ok(guide);
  const { resourceEvidence: _evidence, ...plain } = guide;
  for (const changesStatus of ["pending", "unavailable", "disabled"] as const) {
    const markup = renderPage(
      viewerCatalogue(
        readCatalogue({
          ...fixture,
          changesStatus,
          comparisonUrl: null,
          screens: [],
          components: [],
          useCases: [],
          removedEntries: [],
          tree: [{ kind: "entry", path: "guide" }],
          documents: [],
          treeOrder: [],
          pages: [{ ...plain, changes: { status: changesStatus } }],
        }),
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
      context={{ base: BASE, updateVersion: 1 }}
      view={{ kind: "target", target: { entry: removed.entry, kind: "entry" } }}
    />,
  );
  assert.deepEqual(status(markup), ["Removed"]);
  assert.equal(section(markup), undefined);
});

test("server rendering carries the page evidence that the browser hydrates", () => {
  const model = published({
    changes: { status: "ready", kind: "changed", included: true },
    resourceEvidence: CHANGED,
  });
  const view = viewerView(viewerCatalogue(model), {
    ...defaultSelection,
    screenPath: "guide",
  });
  const html = renderHydratedShellPage(view, {
    base: BASE,
    readModel: model,
    updateVersion: 1,
  }).replaceAll("<!-- -->", "");
  assert.deepEqual(status(html), ["Changed"]);
  assert.ok(html.includes(`${CHANGED_SECTION}</details>`));
});
