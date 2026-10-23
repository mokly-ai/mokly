import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import {
  detailPairs,
  type DetailFixtures,
  rawDetailFixtures,
  shellModelFixture,
} from "./catalogue_v7_fixture.js";
import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

const { catalogue, model, source, sourceVariant } = componentWorkspaceFixture();

const EXCLUDED = {
  path: "mockups/action.css",
  reason: "no-matching-rule",
} as const;

/** The workspace inputs of the index and every detail after one edit. */
function edited(edit: (fixtures: DetailFixtures) => void) {
  const fixtures = rawDetailFixtures();
  edit(fixtures);
  const shell = shellModelFixture(
    undefined,
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  return { catalogue: viewerCatalogue(shell), model: shell };
}

test("a published screen keeps its catalogue view evidence in Current", () => {
  const entry = catalogue.byPath.get("product/browse/details");
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(catalogue, model, entry);
  // The desktop view's evidence is ready and records no stylesheet.
  assert.deepEqual(data.resourceEvidence, [
    { viewport: "mobile", colorScheme: "light", excludedResources: [EXCLUDED] },
    { viewport: "desktop", colorScheme: "light" },
  ]);
  const markup = renderToStaticMarkup(<WorkspaceEvidence data={data} />);
  assert.match(
    markup,
    /<p>This stylesheet changed, but none of the changed styles apply to this screen\.<\/p><p>Examined and excluded:<\/p><ul><li>mockups\/action\.css<\/li><\/ul>/,
  );
  assert.match(markup, /<p>No changes to this screen\.<\/p><\/section>$/);
});

test("a published component keeps its selected saved view's evidence", () => {
  // The parent shows its own views first, so its detail carries their evidence.
  const shown = edited(({ current }) => {
    const variant = current[sourceVariant.path]!;
    for (const view of current[source.path]!.views)
      view.resourceEvidence = structuredClone(
        variant.views.find(
          ({ viewport, colorScheme }) =>
            viewport === view.viewport && colorScheme === view.colorScheme,
        )!.resourceEvidence!,
      );
  });
  for (const path of [source.path, sourceVariant.path]) {
    const entry = shown.catalogue.byPath.get(path);
    assert.ok(entry?.kind === "component");
    const data = publicWorkspace(shown.catalogue, shown.model, entry);
    assert.deepEqual(
      data.resourceEvidence,
      (["mobile", "desktop"] as const).map((viewport) => ({
        viewport,
        colorScheme: "light",
        excludedResources: [EXCLUDED],
      })),
    );
    const markup = renderToStaticMarkup(
      <WorkspaceEvidence data={data} variantPath={path} />,
    );
    assert.match(
      markup,
      /<p>This stylesheet changed, but none of the changed styles apply to this variant\.<\/p>/,
    );
    assert.match(markup, /<p>No changes to this variant\.<\/p><\/section>$/);
  }
});

test("a published screen without view evidence projects none", () => {
  const path = "product/browse/home/empty";
  const unrecorded = edited(({ current }) => {
    for (const view of current[path]!.views) delete view.resourceEvidence;
  });
  const entry = unrecorded.catalogue.byPath.get(path);
  assert.ok(entry?.kind === "screen");
  assert.equal(
    publicWorkspace(unrecorded.catalogue, unrecorded.model, entry)
      .resourceEvidence,
    undefined,
  );
});
