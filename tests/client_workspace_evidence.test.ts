import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { EntryChangeReason } from "../packages/viewer/dist/review/component_types.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";

const SHARED = "mockups/shared.css";
const TOKENS = "mockups/tokens.css";
const SHARED_FILE = "examples/basic/src/components/action/action.mokly.tsx";

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
    unresolved:
      "This change can apply anywhere on the component, so the component stays in Changes:",
    unresolvedWithoutSelectors:
      "This change can apply anywhere on the component, so the component stays in Changes.",
    oneExcluded:
      "This stylesheet changed, but none of the changed styles apply to this variant.",
    severalExcluded:
      "These stylesheets changed, but none of the changed styles apply to this variant.",
  },
} as const;

test("the inspector lists changed files, applying styles, then exclusions", () => {
  const markup = renderEvidence({
    base: "main",
    status: "Changed",
    change: {
      kind: "screen",
      after: { id: "home", route: "screens/home.html", title: "Home" },
      reasons: [
        { kind: "material" },
        {
          kind: "dependency",
          path: SHARED,
          analysis: { status: "matched", selectors: [".auth"] },
        },
      ],
    },
    comparison: {
      dependencies: [],
      id: "home",
      route: "screens/home.html",
      sharedImpact: [SHARED],
      state: "changed",
      title: "Home",
      views: [
        {
          colorScheme: "light",
          ignoredIds: [],
          state: "changed",
          viewport: "mobile",
          reasons: [
            {
              kind: "dependency",
              path: SHARED,
              analysis: { status: "matched", selectors: [".auth"] },
            },
          ],
        },
        {
          colorScheme: "light",
          ignoredIds: [],
          state: "unchanged",
          viewport: "desktop",
          excludedResources: [{ path: TOKENS, reason: "no-matching-rule" }],
        },
      ],
    },
    components: [],
    comparisonEligible: true,
    comparisons: true,
    entry: { id: "home", kind: "screen", route: "screens/home.html" },
    inputChanges: [],
    relatedComponents: [],
    usedBy: [],
    affected: [],
    removed: false,
    variants: [],
    views: [],
  } as unknown as WorkspaceData);

  assert.equal(
    markup,
    '<section class="mbk-comparison-evidence" data-workspace-evidence="">' +
      "<h3>Comparison details</h3>" +
      "<p>Compared with the branch point on main.</p>" +
      "<p>Rendered content changed.</p>" +
      "<p>Changes to these files may affect this screen:</p>" +
      `<ul><li>${SHARED}</li></ul>` +
      "<p>Changed styles that apply to this screen:</p>" +
      '<ul><li><code class="mbk-code">.auth</code></li></ul>' +
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
    entry: { id: "home", kind: "screen", route: "screens/home.html" },
  } as unknown as WorkspaceData);
  assert.match(screen, /<p>No changes to this screen\.<\/p><\/section>$/);

  const component = renderEvidence(
    {
      ...unmodified,
      entry: { id: "badge", kind: "component", route: "components/badge.html" },
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
        {
          kind: "dependency",
          path: SHARED,
          analysis: { status: "matched", selectors: [".action"] },
        },
        {
          kind: "dependency",
          path: TOKENS,
          analysis: { status: "unresolved", selectors: [":root"] },
        },
      ],
      ["mockups/excluded.css"],
    );
    for (const sentence of [
      copy.files,
      copy.matched,
      copy.unresolved,
      copy.oneExcluded,
    ])
      assert.ok(markup.includes(`<p>${sentence}</p>`), sentence);
    assert.ok(markup.includes(`<li>${SHARED_FILE}</li>`));
    if (kind === "component") assert.doesNotMatch(markup, /\bscreen\b/i);
  });

  test(`${kind} Details names unresolved styles without selectors and several exclusions`, () => {
    const markup = renderKindEvidence(
      kind,
      [
        {
          kind: "dependency",
          path: SHARED,
          analysis: { status: "unresolved", selectors: [] },
        },
      ],
      ["mockups/excluded-a.css", "mockups/excluded-b.css"],
    );
    for (const sentence of [
      copy.files,
      copy.unresolvedWithoutSelectors,
      copy.severalExcluded,
    ])
      assert.ok(markup.includes(`<p>${sentence}</p>`), sentence);
    assert.ok(
      markup.includes(
        `<p>${copy.unresolvedWithoutSelectors}</p><p>${copy.severalExcluded}</p>`,
      ),
    );
    if (kind === "component") assert.doesNotMatch(markup, /\bscreen\b/i);
  });

  test(`${kind} Details closes matched styles without selectors with a full stop`, () => {
    const markup = renderKindEvidence(kind, [
      {
        kind: "dependency",
        path: SHARED,
        analysis: { status: "matched", selectors: [] },
      },
    ]);
    assert.ok(markup.includes(`<p>${copy.matchedWithoutSelectors}</p>`));
    if (kind === "component") assert.doesNotMatch(markup, /\bscreen\b/i);
  });
}

function renderKindEvidence(
  kind: "screen" | "component",
  reasons: readonly EntryChangeReason[],
  excluded: readonly string[] = [],
): string {
  const address =
    kind === "component"
      ? { id: "action", route: "components/action.html", title: "Action" }
      : { id: "home", route: "screens/home.html", title: "Home" };
  const view = {
    colorScheme: "light",
    ignoredIds: [],
    state: "changed",
    viewport: "mobile",
    excludedResources: excluded.map((path) => ({
      path,
      reason: "no-matching-rule",
    })),
  };
  const comparison = {
    ...address,
    before: address,
    after: address,
    dependencies: [],
    sharedImpact: [SHARED_FILE],
    state: "changed",
    ...(kind === "component"
      ? {
          variants: [
            {
              id: "default",
              title: "Default",
              state: "changed",
              views: [view],
            },
          ],
        }
      : { views: [view] }),
  };
  return renderEvidence(
    {
      base: "origin/main",
      status: "Changed",
      change: { kind, after: address, reasons },
      comparison,
      components: [],
      comparisonEligible: true,
      comparisons: true,
      entry: { ...address, kind },
      inputChanges: [],
      relatedComponents: [],
      usedBy: [],
      affected: [],
      removed: false,
      variants: [],
      views: [],
    } as unknown as WorkspaceData,
    kind === "component" ? "default" : undefined,
  );
}

function renderEvidence(data: WorkspaceData, variantId?: string): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      data,
      ...(variantId ? { variantId } : {}),
    }),
  );
}
