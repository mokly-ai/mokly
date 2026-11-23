/**
 * Details name the content that the comparison leaves out from the
 * classification evidence of the shown views, so Current names it as a
 * loaded comparison does, and each id once. Only a view whose state is not
 * `unchanged` names its paired ids (CSS evidence presentation contract,
 * shell derivation).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ReviewState } from "@mokly/model";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { publicWorkspace } from "../src/shell/public_workspace.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";
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

/** One view's review state and its paired ignore ids, sorted as recorded. */
interface PairedView {
  state: ReviewState;
  ignoredIds: readonly string[];
}

/**
 * The routed screen's workspace once its detail's mobile and desktop views
 * hold these review states and paired ignore ids.
 */
function pairedWorkspace(
  path: string,
  views: readonly [PairedView, PairedView],
): WorkspaceData {
  const fixtures = rawDetailFixtures();
  fixtures.current[path]!.views.forEach((view, index) => {
    const paired = views[index]!;
    view.state = paired.state;
    view.ignoredIds = [...paired.ignoredIds];
  });
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

/** Details in Current, or once the routed entry's comparison loads. */
function details(data: WorkspaceData, compared = false): string {
  return renderToStaticMarkup(
    <WorkspaceEvidence compared={compared} data={data} />,
  );
}

function occurrences(markup: string, text: string): number {
  return markup.split(text).length - 1;
}

/** The text of each line of Details that names excluded content. */
function excludedLines(markup: string): string[] {
  return [
    ...markup.matchAll(/<p class="mbk-reset">(Excluded content: [^<]*)<\/p>/gu),
  ].map(([, line]) => line!);
}

test("an ignored-only screen names its excluded content in Current", () => {
  const markup = details(
    pairedWorkspace(QUIET, [
      { state: "ignored-only", ignoredIds: ["clock", "nav"] },
      { state: "ignored-only", ignoredIds: ["nav"] },
    ]),
  );
  // The design's order: the excluded content, then the terminal line.
  assert.match(
    markup,
    /<p class="mbk-reset">Excluded content: clock, nav\.<\/p><p class="mbk-reset">No changes to this screen\.<\/p><\/section>$/,
  );
  assert.equal(occurrences(markup, "Excluded content:"), 1);
});

test("Current and a loaded comparison name each excluded id once", () => {
  const data = pairedWorkspace(CHANGED, [
    { state: "changed", ignoredIds: ["clock", "nav"] },
    { state: "changed", ignoredIds: ["nav"] },
  ]);
  for (const compared of [false, true]) {
    const markup = details(data, compared);
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

/** Two views of one screen and the excluded content that its Details name. */
const DIFFERING_VIEWS: readonly {
  name: string;
  path: string;
  views: readonly [PairedView, PairedView];
  lines: readonly string[];
}[] = [
  {
    name: "two unchanged views",
    path: QUIET,
    views: [
      { state: "unchanged", ignoredIds: ["nav"] },
      { state: "unchanged", ignoredIds: ["nav"] },
    ],
    lines: [],
  },
  {
    name: "an ignored-only view beside an unchanged one",
    path: CHANGED,
    views: [
      { state: "ignored-only", ignoredIds: ["clock"] },
      { state: "unchanged", ignoredIds: ["nav"] },
    ],
    lines: ["Excluded content: clock."],
  },
];

test("only a view that differs names its excluded content, in Current and in a loaded comparison", () => {
  for (const { name, path, views, lines } of DIFFERING_VIEWS) {
    const data = pairedWorkspace(path, views);
    for (const compared of [false, true])
      assert.deepEqual(
        excludedLines(details(data, compared)),
        lines,
        `${name}, loaded comparison: ${compared}`,
      );
  }
});
