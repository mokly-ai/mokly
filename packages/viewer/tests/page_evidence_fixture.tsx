import assert from "node:assert/strict";

import { renderToStaticMarkup } from "react-dom/server";

import { readCatalogue } from "../src/catalogue/reader.js";
import type {
  CataloguePage,
  CatalogueReadModel,
} from "../src/catalogue/types.js";
import { cssAnalysis } from "../src/review/css/evidence.js";
import type {
  CssRuleAttribution,
  DependencyReason,
  ResourceEvidence,
} from "../src/review/types.js";
import type { Catalogue } from "../src/shell/catalogue.js";
import type { ShellContext } from "../src/shell/context.js";
import { ShellMain } from "../src/shell/views.js";

import { model as fixture } from "./component_workspace_fixture.js";

export const BASE = "origin/main";

const rule = (fields: Partial<CssRuleAttribution>): CssRuleAttribution => ({
  status: "matched",
  selectors: [],
  changedComponentIds: [],
  pageSelectors: [],
  ...fields,
});
const reason = (
  path: string,
  rules: readonly CssRuleAttribution[],
): DependencyReason => ({
  kind: "dependency",
  path,
  analysis: cssAnalysis(rules),
});

/** The approved story: one rule also changes Action; the page's own sheet has two. */
export const CHANGED: ResourceEvidence = {
  reasons: [
    reason("mockups/actions.css", [
      rule({
        ruleKey: "1".repeat(64),
        selectors: [".action"],
        changedComponentIds: ["action"],
        pageSelectors: [".action"],
      }),
    ]),
    reason("mockups/handbook.css", [
      rule({
        ruleKey: "2".repeat(64),
        selectors: ["article h2"],
        pageSelectors: ["article h2"],
      }),
      rule({
        ruleKey: "3".repeat(64),
        status: "unresolved",
        selectors: [":root"],
      }),
    ]),
  ],
};

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

/** The published fixture with its one page record replaced. */
export function published(page: Partial<CataloguePage>): CatalogueReadModel {
  const guide = fixture.pages.find((item) => item.id === "guide");
  assert.ok(guide);
  const { resourceEvidence: _evidence, ...plain } = guide;
  return readCatalogue(
    JSON.parse(JSON.stringify({ ...fixture, pages: [{ ...plain, ...page }] })),
  );
}

/** Render the routed `guide` page through the shell's main region. */
export function renderPage(
  catalogue: Catalogue,
  context: Partial<ShellContext> = {},
): string {
  const entry = catalogue.byId.get("guide");
  assert.ok(entry?.kind === "page");
  return renderToStaticMarkup(
    <ShellMain
      catalogue={catalogue}
      context={{ base: BASE, updateVersion: 1, ...context }}
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
