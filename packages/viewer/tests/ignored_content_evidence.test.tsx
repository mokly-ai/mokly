/**
 * Details name the content that the comparison leaves out from the
 * classification evidence of the shown views, so Current names it as a
 * loaded comparison does, and each id once (CSS evidence presentation
 * contract, shell derivation).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ReviewState } from "@mokly/model";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { publicWorkspace } from "../src/shell/public_workspace.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";

import {
  detailPairs,
  rawDetailFixtures,
  shellModelFixture,
} from "./catalogue_v9_fixture.js";

/** A screen that Changes does not list, with no other evidence. */
const QUIET = "product/browse/home/empty";
/** A changed screen whose comparison a reader can load. */
const CHANGED = "product/browse/home";

/** The line that names the paired ids of both views, each once. */
const EXCLUDED_CONTENT =
  '<p class="mbk-reset">Excluded content: clock, nav.</p>';

/**
 * The routed screen's workspace once its detail's views pair ignore regions:
 * the mobile view pairs `clock` and `nav`, and the desktop view `nav`, each
 * view's ids sorted as the comparison records them. A given state replaces
 * the review state of both views.
 */
function pairedWorkspace(path: string, state?: ReviewState) {
  const fixtures = rawDetailFixtures();
  const [mobile, desktop] = fixtures.current[path]!.views;
  mobile!.ignoredIds = ["clock", "nav"];
  desktop!.ignoredIds = ["nav"];
  if (state) for (const view of [mobile!, desktop!]) view.state = state;
  const model = shellModelFixture(
    undefined,
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  const catalogue = createCatalogue(model);
  const entry = catalogue.byPath.get(path);
  assert.ok(entry?.kind === "screen");
  return publicWorkspace(catalogue, model, entry);
}

function occurrences(markup: string, text: string): number {
  return markup.split(text).length - 1;
}

test("an ignored-only screen names its excluded content in Current", () => {
  const data = pairedWorkspace(QUIET, "ignored-only");
  const markup = renderToStaticMarkup(<WorkspaceEvidence data={data} />);
  // The design's order: the excluded content, then the terminal line.
  assert.match(
    markup,
    /<p class="mbk-reset">Excluded content: clock, nav\.<\/p><p class="mbk-reset">No changes to this screen\.<\/p><\/section>$/,
  );
  assert.equal(occurrences(markup, "Excluded content:"), 1);
});

test("Current and a loaded comparison name each excluded id once", () => {
  const data = pairedWorkspace(CHANGED);
  for (const compared of [false, true]) {
    const markup = renderToStaticMarkup(
      <WorkspaceEvidence compared={compared} data={data} />,
    );
    assert.equal(
      occurrences(markup, EXCLUDED_CONTENT),
      1,
      `loaded comparison: ${compared}`,
    );
    assert.equal(
      occurrences(markup, "Excluded content:"),
      1,
      `loaded comparison: ${compared}`,
    );
  }
});
