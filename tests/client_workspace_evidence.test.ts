import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { RuleEvidence } from "../packages/viewer/dist/catalogue/types.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type {
  ReviewEntry,
  ReviewResult,
  ReviewView,
} from "../packages/viewer/dist/review/types.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";

const SHARED = "static/shared.css";
const TOKENS = "static/tokens.css";
const PAGE = { kind: "entry" } as const;
const record = (
  stylesheet: string,
  selector: string,
  status: RuleEvidence["status"] = "matched",
  owner: RuleEvidence["owner"] = PAGE,
): RuleEvidence => ({ stylesheet, selector, status, owner });

const EVIDENCE_COPY = {
  screen: {
    files: "Changes to these files may affect this screen:",
    matched: "Changed styles that apply to this screen:",
    matchedWithoutSelectors: "Changed styles that apply to this screen.",
    unresolved:
      "This change can apply anywhere on the screen, so the screen stays in Changes:",
    unresolvedWithoutSelectors:
      "This change can apply anywhere on the screen, so the screen stays in Changes.",
    oneExcluded:
      "This stylesheet changed, but none of the changed styles apply to this screen.",
    severalExcluded:
      "These stylesheets changed, but none of the changed styles apply to this screen.",
  },
  component: {
    files: "Changes to these files may affect this component:",
    matched: "Changed styles that apply to this component:",
    matchedWithoutSelectors: "Changed styles that apply to this component.",
    /** An unresolved record belongs to the saved view's own page. */
    unresolved:
      "This change can apply anywhere on the saved view, so the saved view stays in Changes:",
    unresolvedWithoutSelectors:
      "This change can apply anywhere on the saved view, so the saved view stays in Changes.",
    oneExcluded:
      "This stylesheet changed, but none of the changed styles apply to this variant.",
    severalExcluded:
      "These stylesheets changed, but none of the changed styles apply to this variant.",
  },
} as const;

test("the inspector lists changed files, applying styles, then exclusions", () => {
  const home = entry(
    "screen",
    "home",
    "Home",
    [{ kind: "dependency", path: SHARED }, { kind: "material" }],
    [
      view("mobile", "changed", [record(SHARED, ".auth")]),
      view("desktop", "unchanged", [record(TOKENS, "", "excluded")]),
    ],
  );
  const markup = renderEvidence(
    {
      base: "main",
      status: "Changed",
      components: [],
      comparisonEligible: true,
      comparisons: true,
      entry: { path: "home", kind: "screen", route: "home/index.html" },
      inputChanges: [],
      relatedComponents: [],
      usedBy: [],
      affected: [],
      removed: false,
      variants: [],
      views: [],
    } as unknown as WorkspaceData,
    undefined,
    loaded(home),
  );

  assert.equal(
    markup,
    '<section class="mbk-comparison-evidence" data-workspace-evidence="">' +
      "<h3>Comparison details</h3>" +
      "<p>Compared with the branch point on main.</p>" +
      "<p>Rendered content changed.</p>" +
      "<p>Changes to these files may affect this screen:</p>" +
      `<ul class="mbk-evidence-files"><li>${SHARED}` +
      "<p>Changed styles that apply to this screen:</p>" +
      '<ul><li><code class="mbk-code">.auth</code></li></ul>' +
      "</li></ul>" +
      "<p>This stylesheet changed, but none of the changed styles apply to this screen.</p>" +
      "<p>Examined and excluded:</p>" +
      `<ul><li>${TOKENS}</li></ul>` +
      "</section>",
  );
});

test("the terminal line names the screen or the saved view it compared", () => {
  const unmodified = {
    base: "main",
    status: "Unmodified",
    components: [],
    comparisonEligible: false,
    comparisons: true,
    inputChanges: [],
    relatedComponents: [],
    usedBy: [],
    affected: [],
    removed: false,
    variants: [],
    views: [],
  };

  const screen = renderEvidence({
    ...unmodified,
    entry: { path: "home", kind: "screen", route: "home/index.html" },
  } as unknown as WorkspaceData);
  assert.match(screen, /<p>No changes to this screen\.<\/p><\/section>$/);

  const component = renderEvidence(
    {
      ...unmodified,
      entry: { path: "badge", kind: "component", route: "badge/index.html" },
    } as unknown as WorkspaceData,
    "default",
  );
  assert.match(
    component,
    /<p>No changes to this saved view\.<\/p><\/section>$/,
  );
});

for (const kind of ["screen", "component"] as const) {
  const copy = EVIDENCE_COPY[kind];
  test(`${kind} Details names files, matched and unresolved selectors, and one exclusion`, () => {
    const markup = renderKindEvidence(
      kind,
      [
        ...entryRules(kind, SHARED, "matched", [".action"]),
        ...entryRules(kind, TOKENS, "unresolved", [":root"]),
      ],
      ["static/excluded.css"],
    );
    for (const sentence of [
      copy.files,
      copy.matched,
      copy.unresolved,
      copy.oneExcluded,
    ])
      assert.ok(markup.includes(`<p>${sentence}</p>`), sentence);
    assert.ok(markup.includes(`<li>${SHARED}<p>${copy.matched}</p>`));
    assert.ok(markup.includes(`<li>${TOKENS}<p>${copy.unresolved}</p>`));
    if (kind === "component") assert.doesNotMatch(markup, /\bscreen\b/i);
  });

  test(`${kind} Details names unresolved styles without selectors and several exclusions`, () => {
    const markup = renderKindEvidence(
      kind,
      entryRules(kind, SHARED, "unresolved", []),
      ["static/excluded-a.css", "static/excluded-b.css"],
    );
    for (const sentence of [
      copy.files,
      copy.unresolvedWithoutSelectors,
      copy.severalExcluded,
    ])
      assert.ok(markup.includes(`<p>${sentence}</p>`), sentence);
    assert.ok(
      markup.includes(
        `<p>${copy.unresolvedWithoutSelectors}</p></li></ul><p>${copy.severalExcluded}</p>`,
      ),
    );
    if (kind === "component") assert.doesNotMatch(markup, /\bscreen\b/i);
  });

  test(`${kind} Details closes matched styles without selectors with a full stop`, () => {
    const markup = renderKindEvidence(
      kind,
      entryRules(kind, SHARED, "matched", [""]),
    );
    assert.ok(markup.includes(`<p>${copy.matchedWithoutSelectors}</p>`));
    if (kind === "component") assert.doesNotMatch(markup, /\bscreen\b/i);
  });
}

/**
 * Screen page records, or records that changed the component on its own
 * pages. An unresolved record is the page's own; no selector is one record.
 */
function entryRules(
  kind: "screen" | "component",
  stylesheet: string,
  status: "matched" | "unresolved",
  selectors: readonly string[],
): RuleEvidence[] {
  const owner =
    kind === "component" && status === "matched"
      ? ({ kind: "component", path: "action" } as const)
      : PAGE;
  return (selectors.length ? selectors : [""]).map((selector) =>
    record(stylesheet, selector, status, owner),
  );
}

function view(
  viewport: "mobile" | "desktop",
  state: ReviewView["state"],
  rules: RuleEvidence[],
): ReviewView {
  return { viewport, colorScheme: "light", state, ignoredIds: [], rules };
}

/** One changed entry record: a screen, or a component with these props. */
function entry(
  kind: "screen" | "component",
  path: string,
  title: string,
  reasons: ReviewEntry["reasons"],
  views: ReviewView[],
): ReviewEntry {
  const side = {
    path,
    title,
    props: {},
    ...(kind === "component" ? { suppliedSlots: [] } : {}),
  };
  const state = "changed";
  return {
    kind,
    path,
    title,
    before: side,
    after: side,
    state,
    included: true,
    reasons,
    views,
  };
}

function renderKindEvidence(
  kind: "screen" | "component",
  kept: readonly RuleEvidence[],
  excluded: readonly string[] = [],
): string {
  const rules = [
    ...kept,
    ...excluded.map((path) => record(path, "", "excluded")),
  ].sort((a, b) => (a.stylesheet < b.stylesheet ? -1 : 1));
  const reasons = [...new Set(kept.map((rule) => rule.stylesheet))]
    .sort()
    .map((path) => ({ kind: "dependency" as const, path }));
  const views = [view("mobile", "changed", rules)];
  const comparison: ReviewEntry =
    kind === "screen"
      ? entry(kind, "home", "Home", reasons, views)
      : {
          ...entry(kind, "action", "Action", reasons, views),
          variants: [entry(kind, "action/default", "Default", reasons, views)],
        };
  const { path, title } = comparison;
  return renderEvidence(
    {
      base: "origin/main",
      status: "Changed",
      ...(kind === "component" ? { component: { path, title, kind } } : {}),
      components: [],
      comparisonEligible: true,
      comparisons: true,
      entry: { path, title, kind },
      inputChanges: [],
      relatedComponents: [],
      usedBy: [],
      affected: [],
      removed: false,
      variants: [],
      views: [],
    } as unknown as WorkspaceData,
    kind === "component" ? "action/default" : undefined,
    loaded(comparison),
  );
}

/** A loaded comparison that holds one entry record. */
function loaded(entry: ReviewEntry): ReviewResult {
  return parseReviewResult({
    schemaVersion: 8,
    baseCommit: "a".repeat(40),
    entries: [entry],
    affected: [],
    diagnostics: [],
  });
}

function renderEvidence(
  data: WorkspaceData,
  variantPath?: string,
  comparison?: ReviewResult,
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      data,
      ...(variantPath ? { variantPath } : {}),
      ...(comparison ? { loaded: comparison } : {}),
    }),
  );
}
