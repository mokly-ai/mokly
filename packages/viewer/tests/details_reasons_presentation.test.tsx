/**
 * Details show an entry's direct reasons from its detail before a comparison
 * loads, and Current, a loaded comparison, and a later publication keep each
 * fact once (decision D1 of the shell delivery contract). Each reason reads as
 * its sentence in the component workspace design's table.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { detailKey } from "../src/catalogue/detail_fences.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";
import type { EntryChangeReason } from "../src/review/types.js";
import { catalogueSelectionEntry } from "../src/shell/catalogue.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";
import { mergeWorkspaceEvidence } from "../src/shell/workspace_evidence_merge.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import {
  detailPairs,
  type DetailFixtures,
  indexFixture,
  rawDetailFixtures,
  shellModelFixture,
} from "./catalogue_v9_fixture.js";

const HOME = "product/browse/home";
const ACTION = "components/action";
const MATERIAL = "<p>Rendered content changed.</p>";
const IMPLEMENTATION =
  "<p>Rendered content changed where this component is used.</p>";
const BRANCH_POINT = "<p>Compared with the branch point on main.</p>";
const RETIRED_PATH = "product/browse/home/retired";
const RETIRED =
  "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e";

/** The sentence table of mokly-component-workspace-design.md. */
const SENTENCES: readonly (readonly [EntryChangeReason, string])[] = [
  [{ kind: "added" }, "Added to this branch."],
  [{ kind: "removed" }, "Removed on this branch."],
  [{ kind: "material" }, "Rendered content changed."],
  [
    { kind: "implementation" },
    "Rendered content changed where this component is used.",
  ],
  [{ kind: "inputs" }, "Supplied props or slots changed."],
  [{ kind: "structure" }, "Component instances changed."],
  [{ kind: "metadata" }, "Page details or saved examples changed."],
];

/** The routed workspace of one path over edited fixtures. */
function workspace(
  path: string,
  edit: (fixtures: DetailFixtures) => void = () => {},
  index: CatalogueReadModel = indexFixture(),
) {
  const fixtures = rawDetailFixtures();
  edit(fixtures);
  const model = shellModelFixture(
    index,
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  const catalogue = viewerCatalogue(model);
  const entry = catalogue.byPath.get(path);
  assert.ok(entry?.kind === "screen" || entry?.kind === "component");
  return publicWorkspace(catalogue, model, entry, true, undefined, "main");
}

/** How often one complete fragment appears in the markup. */
function count(markup: string, fragment: string): number {
  return markup.split(fragment).length - 1;
}

test("Details show the detail's reasons before a comparison loads", () => {
  const data = workspace(HOME);
  assert.deepEqual(data.reasons, [{ kind: "material" }]);
  const markup = renderToStaticMarkup(<WorkspaceEvidence data={data} />);
  assert.match(
    markup,
    /^<section class="mbk-comparison-evidence" data-workspace-evidence=""><h3>Comparison details<\/h3><p>Compared with the branch point on main\.<\/p><p>Rendered content changed\.<\/p>/,
  );
  assert.equal(count(markup, MATERIAL), 1);
});

test("each reason reads as its one sentence after the branch point", () => {
  const data = workspace(HOME);
  for (const [reason, sentence] of SENTENCES) {
    const markup = renderToStaticMarkup(
      <WorkspaceEvidence data={{ ...data, reasons: [reason] }} />,
    );
    assert.ok(markup.includes(`${BRANCH_POINT}<p>${sentence}</p>`), sentence);
    for (const [, other] of SENTENCES)
      assert.equal(
        count(markup, `<p>${other}</p>`),
        other === sentence ? 1 : 0,
        `${reason.kind}: ${other}`,
      );
  }
});

test("a screen reason, which only a use case carries, has no sentence", () => {
  const data = workspace(HOME);
  const none = renderToStaticMarkup(
    <WorkspaceEvidence data={{ ...data, reasons: [] }} />,
  );
  const screen = renderToStaticMarkup(
    <WorkspaceEvidence
      data={{ ...data, reasons: [{ kind: "screen", screenPath: HOME }] }}
    />,
  );
  assert.equal(screen, none);
});

test("a removed snapshot's Details read its removed reason once", () => {
  const model = shellModelFixture();
  const catalogue = viewerCatalogue(model);
  const entry = catalogueSelectionEntry(catalogue, RETIRED_PATH, RETIRED);
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(catalogue, model, entry, true, RETIRED, "main");
  assert.equal(data.removed, true);
  assert.equal(data.status, "Removed");
  assert.deepEqual(data.reasons, [{ kind: "removed" }]);
  const markup = renderToStaticMarkup(<WorkspaceEvidence data={data} />);
  assert.ok(markup.includes(`${BRANCH_POINT}<p>Removed on this branch.</p>`));
  assert.equal(count(markup, "Removed on this branch."), 1);
});

test("a loaded comparison and Current keep each reason once", () => {
  const data = workspace(HOME);
  const current = renderToStaticMarkup(<WorkspaceEvidence data={data} />);
  assert.ok(data.compared);
  const loaded = renderToStaticMarkup(
    <WorkspaceEvidence compared data={data} />,
  );
  assert.equal(count(loaded, MATERIAL), 1);
  assert.equal(count(loaded, "<h3>Comparison details</h3>"), 1);
  assert.equal(loaded, current);
});

test("a component's implementation reason reads in Current", () => {
  const index = indexFixture((raw) => {
    raw.components.find((entry) => entry.path === ACTION)!.changes = {
      status: "ready",
      kind: "changed",
      included: true,
    };
  });
  const data = workspace(
    ACTION,
    ({ current }) => {
      current[ACTION]!.reasons = [{ kind: "implementation" }];
    },
    index,
  );
  const markup = renderToStaticMarkup(
    <WorkspaceEvidence data={data} variantPath={ACTION} />,
  );
  assert.equal(count(markup, IMPLEMENTATION), 1);
  assert.equal(count(markup, MATERIAL), 0);
});

test("a pure move and an entry outside Changes show no reason", () => {
  for (const path of ["product/browse/details", "product/browse/home/empty"]) {
    const data = workspace(path);
    const markup = renderToStaticMarkup(<WorkspaceEvidence data={data} />);
    assert.doesNotMatch(markup, /Rendered content changed|Added to this/);
  }
  assert.deepEqual(workspace("product/browse/details").reasons, []);
  assert.equal(workspace("product/browse/home/empty").reasons, undefined);
});

test("a publication without reasons clears the held ones", () => {
  const held = workspace(HOME);
  const next = workspace(
    HOME,
    ({ current }) => {
      delete current[HOME]!.reasons;
    },
    indexFixture((raw) => {
      raw.screens.find((entry) => entry.path === HOME)!.changes = {
        status: "ready",
        kind: "unmodified",
        included: false,
      };
    }),
  );
  mergeWorkspaceEvidence(held, next);
  assert.equal(Object.hasOwn(held, "reasons"), false);
  assert.equal(
    count(renderToStaticMarkup(<WorkspaceEvidence data={held} />), MATERIAL),
    0,
  );
});

test("Details ignore reasons that the index does not list", () => {
  // The index keeps the screen outside Changes, so its detail's reasons stay
  // hidden, and an included record whose detail predates reasons shows none.
  const outside = workspace("product/browse/home/empty", ({ current }) => {
    current["product/browse/home/empty"]!.reasons = [{ kind: "material" }];
  });
  assert.equal(outside.reasons, undefined);
  const earlier = workspace(HOME, ({ current }) => {
    delete current[HOME]!.reasons;
  });
  assert.equal(earlier.reasons, undefined);
  for (const data of [outside, earlier])
    assert.equal(
      count(renderToStaticMarkup(<WorkspaceEvidence data={data} />), MATERIAL),
      0,
    );
});
