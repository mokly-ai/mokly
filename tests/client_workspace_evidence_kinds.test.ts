import assert from "node:assert/strict";
import test from "node:test";

import type { RuleEvidence } from "../packages/viewer/dist/catalogue/types.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import {
  entry,
  PAGE,
  record,
  renderEvidence,
  view,
} from "./helpers/workspace_evidence.js";

const SHARED = "static/shared.css";
const TOKENS = "static/tokens.css";

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
    /** An unresolved record belongs to the variant's own page. */
    unresolved:
      "This change can apply anywhere on the variant, so the variant stays in Changes:",
    unresolvedWithoutSelectors:
      "This change can apply anywhere on the variant, so the variant stays in Changes.",
    oneExcluded:
      "This stylesheet changed, but none of the changed styles apply to this variant.",
    severalExcluded:
      "These stylesheets changed, but none of the changed styles apply to this variant.",
  },
} as const;

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
      assert.ok(
        markup.includes(`<p class="mbk-reset">${sentence}</p>`),
        sentence,
      );
    assert.ok(
      markup.includes(
        `<li class="mbk-reset">${SHARED}<p class="mbk-reset">${copy.matched}</p>`,
      ),
    );
    assert.ok(
      markup.includes(
        `<li class="mbk-reset">${TOKENS}<p class="mbk-reset">${copy.unresolved}</p>`,
      ),
    );
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
      assert.ok(
        markup.includes(`<p class="mbk-reset">${sentence}</p>`),
        sentence,
      );
    assert.ok(
      markup.includes(
        `<p class="mbk-reset">${copy.unresolvedWithoutSelectors}</p></li></ul><p class="mbk-reset">${copy.severalExcluded}</p>`,
      ),
    );
    if (kind === "component") assert.doesNotMatch(markup, /\bscreen\b/i);
  });

  test(`${kind} Details closes matched styles without selectors with a full stop`, () => {
    const markup = renderKindEvidence(
      kind,
      entryRules(kind, SHARED, "matched", [""]),
    );
    assert.ok(
      markup.includes(
        `<p class="mbk-reset">${copy.matchedWithoutSelectors}</p>`,
      ),
    );
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
  const [path, title] =
    kind === "screen" ? ["home", "Home"] : ["action", "Action"];
  // A component workspace compares its routed variant.
  const comparison = entry(
    kind,
    kind === "screen" ? path : "action/default",
    reasons,
    views,
  );
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
    comparison,
  );
}
