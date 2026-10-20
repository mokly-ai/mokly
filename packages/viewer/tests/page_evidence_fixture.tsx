import assert from "node:assert/strict";

import { renderToStaticMarkup } from "react-dom/server";

import {
  detailKey,
  type DetailRequest,
} from "../src/catalogue/detail_fences.js";
import type { ShellCatalogueReadModel } from "../src/catalogue/scoped_types.js";
import type {
  CataloguePage,
  CatalogueReadModel,
  EntryDetailV1,
  ViewEvidence,
} from "../src/catalogue/types.js";
import type { EntryChangeReason } from "../src/review/types.js";
import type { Catalogue } from "../src/shell/catalogue.js";
import { ShellMain } from "../src/shell/views.js";

import {
  detailPairs,
  indexFixture,
  rawDetailFixtures,
  shellModelFixture,
} from "./catalogue_v7_fixture.js";

export const BASE = "origin/main";

/**
 * The approved story as review v8 records: one rule also changes Action; the
 * page's own sheet has two.
 */
export const CHANGED: ViewEvidence = {
  rules: [
    {
      stylesheet: "mockups/actions.css",
      selector: ".action",
      status: "matched",
      owner: { kind: "component", path: "components/action" },
    },
    {
      stylesheet: "mockups/actions.css",
      selector: ".action",
      status: "matched",
      owner: { kind: "entry" },
    },
    {
      stylesheet: "mockups/handbook.css",
      selector: "article h2",
      status: "matched",
      owner: { kind: "entry" },
    },
    {
      stylesheet: "mockups/handbook.css",
      selector: ":root",
      status: "unresolved",
      owner: { kind: "entry" },
    },
  ],
  resources: [],
};

/** The direct reasons of a page whose own rules in {@link CHANGED} changed. */
export const CHANGED_REASONS: EntryChangeReason[] = [
  { kind: "dependency", path: "mockups/actions.css" },
  { kind: "dependency", path: "mockups/handbook.css" },
];

/** The exact comparison details the shell renders for {@link CHANGED}. */
export const CHANGED_SECTION =
  '<section class="mbk-comparison-evidence" data-page-evidence="">' +
  "<h3>Comparison details</h3>" +
  `<p>Compared with the branch point on ${BASE}.</p>` +
  "<p>Changes to these files may affect this page:</p>" +
  '<ul class="mbk-evidence-files"><li>mockups/actions.css' +
  "<p>These changed styles also apply outside the changed components on this page:</p>" +
  '<ul><li><code class="mbk-code">.action</code></li></ul></li>' +
  "<li>mockups/handbook.css" +
  "<p>Changed styles that apply to this page:</p>" +
  '<ul><li><code class="mbk-code">article h2</code></li></ul>' +
  "<p>This change can apply anywhere on the page, so the page stays in Changes:</p>" +
  '<ul><li><code class="mbk-code">:root</code></li></ul></li></ul>' +
  "</section>";

/**
 * The published index with its one page record edited and `base` as its
 * branch name; `null` publishes no branch name.
 */
export function publishedIndex(
  page: Partial<CataloguePage>,
  base: string | null = BASE,
): CatalogueReadModel {
  return indexFixture((index) => {
    if (base === null) delete index.base;
    else index.base = base;
    index.pages = index.pages.map((guide) => ({ ...guide, ...page }));
  });
}

/**
 * Every fixture detail, with the page's detail carrying `evidence` or none,
 * and the `reasons` of a page that Changes includes.
 */
export function publishedDetails(
  evidence?: ViewEvidence,
  reasons?: EntryChangeReason[],
): (readonly [DetailRequest, EntryDetailV1])[] {
  const fixtures = rawDetailFixtures();
  const guide = fixtures.current["guide"];
  assert.ok(guide);
  delete guide.resourceEvidence;
  if (evidence) guide.resourceEvidence = evidence;
  if (reasons) guide.reasons = reasons;
  return detailPairs(undefined, fixtures);
}

/** The shell model of the published index and its held details. */
export function published(
  page: Partial<CataloguePage>,
  evidence?: ViewEvidence,
): ShellCatalogueReadModel {
  return shellModelFixture(
    publishedIndex(page),
    new Map(
      publishedDetails(evidence).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
}

/** Render the routed `guide` page through the shell's main region. */
export function renderPage(catalogue: Catalogue): string {
  const entry = catalogue.byPath.get("guide");
  assert.ok(entry?.kind === "page");
  return renderToStaticMarkup(
    <ShellMain
      catalogue={catalogue}
      context={{ base: BASE }}
      view={{ kind: "target", target: { entry, kind: "entry" } }}
    />,
  );
}

/** Every status badge beside the routed title. */
export const status = (markup: string) =>
  [
    ...markup.matchAll(
      /<span class="mbk-entry-status" data-status="(\w+)">\1<\/span>/g,
    ),
  ].map((match) => match[1]);

/** The page's comparison details, or undefined when none render. */
export const section = (markup: string) =>
  /<section class="mbk-comparison-evidence" data-page-evidence="">.*?<\/section>/.exec(
    markup,
  )?.[0];
