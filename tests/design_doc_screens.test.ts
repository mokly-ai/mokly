import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import {
  headCrumbs,
  headTitle,
  rowIcon,
  rowLabels,
} from "./helpers/design_rows.js";

const DOC_DESIGNS = [
  "design-doc-view",
  "design-doc-details",
  "design-doc-navigation",
  "design-doc-removed",
] as const;
const CURRENT_DOC_DESIGNS = DOC_DESIGNS.slice(0, 3);

type Document = Awaited<ReturnType<typeof designDocument>>["document"];

/** The Details rows a design draws, keyed by their visible label. */
function metadata(document: Document): Map<string, Element> {
  return new Map(
    byClass(document, "mbk-meta-row").map((row) => [
      textContent(byClass(row, "mbk-meta-k")[0]!).trim(),
      byClass(row, "mbk-meta-v")[0]!,
    ]),
  );
}

function hasClass(node: Element, name: string): boolean {
  return (attribute(node, "class") ?? "").split(/\s+/u).includes(name);
}

test("doc designs live in Specification docs and inherit both schemes", async () => {
  const { manifest } = await designCatalogue;
  for (const id of DOC_DESIGNS) {
    const entry = manifest.entries.find((candidate) => candidate.id === id);
    assert.ok(entry?.kind === "screen", id);
    assert.deepEqual(
      entry.navPath,
      ["Design", "Mokly design", "Browse shell", "Specification docs"],
      id,
    );
    assert.deepEqual(entry.colorSchemes, ["light", "dark"], id);
    assert.deepEqual(entry.relatedDocs, ["docs/protocol/mokly-docs.md"], id);
    for (const sheet of ["design.css", "design-stage.css", "design-doc.css"])
      assert.ok(
        entry.declaredDependencies.includes(
          `examples/basic/generated/${sheet}`,
        ),
        `${id}: ${sheet}`,
      );
  }
});

for (const viewport of ["mobile", "desktop"] as const)
  for (const scheme of ["light", "dark"] as const)
    test(`${viewport} ${scheme}: a doc reads in the plain pane in the artboard's scheme`, async () => {
      for (const id of DOC_DESIGNS) {
        const { document, html } = await designDocument(id, viewport, scheme);
        assert.deepEqual(
          elements(document, (node) =>
            Boolean(attribute(node, "data-mbk-appearance")),
          ).map((node) => attribute(node, "data-mbk-appearance")),
          [scheme],
          id,
        );
        assert.deepEqual(
          byClass(document, "mbk-appearance").map((node) =>
            attribute(node, "data-appearance-value"),
          ),
          [scheme],
          `${id}: one Appearance selector naming the rendered scheme`,
        );
        assert.equal(byClass(document, "mbk-doc-pane").length, 1, id);
        for (const absent of [
          "phone-frame",
          "browser-frame",
          "mbk-cmp-toolbar",
        ])
          assert.equal(byClass(document, absent).length, 0, `${id}: ${absent}`);
        assert.equal(
          elements(
            document,
            (node) => attribute(node, "aria-label") === "Preview options",
          ).length,
          0,
          `${id}: a doc has no viewport control`,
        );
        assert.match(html, /href="[^"]*design-doc\.css"/u, id);
        const views = byClass(document, "mbk-doc-view");
        assert.equal(views.length, 1, id);
        const removed = id === "design-doc-removed";
        assert.equal(
          hasClass(views[0]!, "mbk-screen-dark"),
          scheme === "dark" && !removed,
          `${id}: a current doc follows the scheme; a previous version stays light`,
        );
        assert.equal(
          byClass(document, "mbk-previous-scheme-note").length,
          Number(removed && scheme === "dark"),
          `${id}: only a dark removed doc names its light-only fallback`,
        );
      }
    });

test("a current doc renders its Markdown body under its own head", async () => {
  for (const id of CURRENT_DOC_DESIGNS) {
    const { document } = await designDocument(id, "desktop");
    assert.equal(headTitle(document), "Welcome specification", id);
    assert.deepEqual(
      headCrumbs(document),
      [
        ["Catalogue home", "design-browse-home"],
        ["Example", undefined],
      ],
      id,
    );
    assert.deepEqual(
      byClass(document, "mbk-idchip").map((chip) => textContent(chip).trim()),
      ["#welcome-specification"],
      id,
    );
    const view = byClass(document, "mbk-doc-view")[0]!;
    const tags = (name: string) =>
      elements(view, (node) => node.tagName === name);
    assert.deepEqual(
      tags("h1").map((node) => attribute(node, "id")),
      ["welcome-specification"],
    );
    assert.deepEqual(
      tags("h2").map((node) => attribute(node, "id")),
      ["what-the-screen-shows", "states"],
    );
    assert.equal(tags("ul").length, 1, id);
    assert.equal(tags("table").length, 1, id);
    assert.deepEqual(tags("code").map(textContent), ["Name this workspace"]);
  }
});

test("doc Details list the doc's own source, schemes, tags, related doc and dependencies", async () => {
  for (const viewport of ["mobile", "desktop"] as const) {
    const { document } = await designDocument("design-doc-details", viewport);
    const rows = metadata(document);
    assert.deepEqual(
      [...rows.keys()],
      ["Source", "Schemes", "Tags", "Related docs", "Dependencies"],
    );
    assert.equal(
      textContent(rows.get("Source")!).trim(),
      "docs/welcome-specification.md",
    );
    assert.equal(textContent(rows.get("Schemes")!).trim(), "light, dark");
    assert.equal(textContent(rows.get("Tags")!).trim(), "onboarding");
    assert.equal(
      textContent(rows.get("Dependencies")!).trim(),
      "docs/welcome-specification.md",
    );
    const related = elements(rows.get("Related docs")!, (node) =>
      hasClass(node, "mbk-code"),
    );
    assert.deepEqual(
      related.map((node) => [node.tagName, textContent(node).trim()]),
      [["a", "notes.md"]],
    );
    assert.equal(
      elements(related[0]!, (node) => node.tagName === "svg").length,
      1,
      "the linked doc chip draws the doc icon",
    );
    const removed = await designDocument("design-doc-removed", viewport);
    assert.deepEqual(
      [...metadata(removed.document).keys()],
      ["Source", "Tags"],
    );
    assert.match(
      textContent(byClass(removed.document, "mbk-details-body")[0]!),
      /Location: Example › Guides/u,
    );
  }
});

test("the doc row draws its own icon beside the other Example leaves", async () => {
  const home = await designDocument("design-browse-home", "desktop");
  const pages = byClass(home.document, "mbk-nav-section").find(
    (section) => attribute(section, "data-nav-section") === "pages",
  );
  assert.ok(pages);
  assert.deepEqual(rowLabels(pages).slice(0, 6), [
    "Example",
    "Screens",
    "Welcome",
    "Details",
    "Example tour",
    "Welcome specification",
  ]);
  const doc = await designDocument("design-doc-view", "desktop");
  const page = await designDocument("design-page-view", "desktop");
  const [docClass, docIcon] = rowIcon(doc.document, "Welcome specification");
  const [pageClass, pageIcon] = rowIcon(page.document, "Getting started");
  assert.equal(docClass, "mbk-nav-ico");
  assert.equal(pageClass, "mbk-nav-ico");
  for (const other of [
    pageIcon,
    rowIcon(doc.document, "Welcome")[1],
    rowIcon(doc.document, "Example tour")[1],
  ])
    assert.notEqual(docIcon, other);
  const removed = await designDocument("design-doc-removed", "desktop");
  assert.equal(rowIcon(removed.document, "Naming guide · Removed")[1], docIcon);
});
