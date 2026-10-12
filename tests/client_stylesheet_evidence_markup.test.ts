import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  COMPONENT_STYLE_COPY,
  SCREEN_STYLE_COPY,
} from "../examples/basic/specs/design/parts/stylesheet_evidence.js";
import type { ReviewResultV7 } from "../packages/viewer/dist/review/component_types.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type { ViewReview } from "../packages/viewer/dist/review/types.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";

import { cssReason, cssRule } from "./helpers/css_evidence.js";

const RULES = "mockups/rule.css";
const outsideRule = cssRule({
  ruleKey: "1".repeat(64),
  selectors: [".action", ".heading"],
  changedComponentPaths: ["action"],
  pageSelectors: [".heading"],
});
const componentRule = cssRule({
  ruleKey: "2".repeat(64),
  selectors: [".action"],
  changedComponentPaths: ["action"],
});

test("a screen's changed file holds its outside sentence and styles, as the mockup does", () => {
  const data = screenWorkspace([view("mobile", "light", [outsideRule])]);
  const markup = render(data);
  assert.ok(
    markup.includes(
      `<p>${SCREEN_STYLE_COPY.files}</p>` +
        `<ul class="mbk-evidence-files"><li>${RULES}` +
        `<p>${SCREEN_STYLE_COPY.outside}</p>` +
        '<ul><li><code class="mbk-code">.heading</code></li></ul>' +
        "</li></ul>",
    ),
    markup,
  );
  assert.doesNotMatch(markup, />\.action</);
  assert.ok(!markup.includes("1".repeat(64)));
});

test("a component's own page keeps the mockup's matched-component sentence", () => {
  const data = componentWorkspace("Changed", [componentRule]);
  const markup = render(data, "action/default");
  assert.ok(
    markup.includes(
      `<p>${COMPONENT_STYLE_COPY.files}</p>` +
        `<ul class="mbk-evidence-files"><li>${RULES}` +
        `<p>${COMPONENT_STYLE_COPY.matched}</p>` +
        '<ul><li><code class="mbk-code">.action</code></li></ul>' +
        "</li></ul>",
    ),
    markup,
  );
});

test("paths and selectors render as text, including generated bundle paths", () => {
  const bundle = "mockups/mokly-generated/styles/entries/a&b.mockup.tsx.css";
  const odd = cssRule({
    selectors: ['[aria-label="<tip>"]'],
    pageSelectors: ['[aria-label="<tip>"]'],
  });
  const data = screenWorkspace([]);
  data.resourceEvidence = [
    {
      viewport: "mobile",
      colorScheme: "light",
      reasons: [cssReason(bundle, [odd])],
    },
  ];
  const markup = render(data);
  assert.ok(
    markup.includes(
      "<li>mockups/mokly-generated/styles/entries/a&amp;b.mockup.tsx.css<p>",
    ),
    markup,
  );
  assert.ok(
    markup.includes(
      '<code class="mbk-code">[aria-label=&quot;&lt;tip&gt;&quot;]</code>',
    ),
  );
});

test("classification and a loaded comparison merge into one file and one paragraph", () => {
  const data = screenWorkspace([view("mobile", "light", [outsideRule])]);
  data.change = {
    kind: "screen",
    before: { path: "home", title: "Home" },
    after: { path: "home", title: "Home" },
    reasons: [cssReason(RULES, [outsideRule])],
  };
  const loaded = loadedScreen([view("mobile", "light", [outsideRule])]);
  const markup = render(data, undefined, loaded);
  assert.equal(markup.split(`<li>${RULES}<p>`).length - 1, 1);
  assert.equal(markup.split(SCREEN_STYLE_COPY.outside).length - 1, 1);
  assert.equal(markup.split(">.heading</code>").length - 1, 1);
});

test("Details read the same facts whatever viewport or scheme is shown", () => {
  const tone = cssRule({
    ruleKey: "4".repeat(64),
    status: "unresolved",
    selectors: [".tone"],
  });
  const data = screenWorkspace([
    view("mobile", "light", [outsideRule]),
    view("desktop", "dark", [tone]),
  ]);
  const markup = render(data);
  assert.ok(
    markup.includes(
      `<p>${SCREEN_STYLE_COPY.outside}</p>` +
        '<ul><li><code class="mbk-code">.heading</code></li></ul>' +
        `<p>${SCREEN_STYLE_COPY.unresolved}</p>` +
        '<ul><li><code class="mbk-code">.tone</code></li></ul>',
    ),
    markup,
  );
});

test("a consuming component shows its live view evidence before any comparison loads", () => {
  const data = componentWorkspace("Unmodified", [componentRule], "toolbar");
  delete data.change;
  data.relatedComponents = [{ path: "action", title: "Action" }];
  data.variants = savedViews("toolbar/default", "Changed");
  const markup = render(data, "toolbar/default");
  assert.match(
    markup,
    /<li>mockups\/rule\.css<p>Changed styles that apply to this component:<\/p>/,
  );
  assert.match(markup, /Shared component changes affect this preview\./);
  assert.doesNotMatch(markup, /No changes to this saved view\./);
});

test("a parent route closes with the selected saved view's own status", () => {
  const frame = cssRule({ selectors: [".frame"], pageSelectors: [".frame"] });
  const data = componentWorkspace("Unmodified", [frame]);
  delete data.change;
  data.variants = savedViews("action/default", "Changed");
  const markup = render(data, "action/default");
  assert.match(markup, /Changed styles that apply to this saved view:/);
  assert.doesNotMatch(markup, /No changes to this saved view\./);
  assert.doesNotMatch(markup, /Shared component changes/);
});

function savedViews(
  path: string,
  status: "Changed" | "Unmodified",
): WorkspaceData["variants"] {
  return [
    { value: { path }, removed: false, comparisonEligible: true, status },
  ] as unknown as WorkspaceData["variants"];
}

function view(
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
  rules: Parameters<typeof cssReason>[1],
): ViewReview {
  return {
    viewport,
    colorScheme,
    state: "changed",
    ignoredIds: [],
    reasons: [cssReason(RULES, rules)],
  };
}

function screenWorkspace(views: readonly ViewReview[]): WorkspaceData {
  return {
    base: "main",
    status: "Changed",
    entry: { path: "home", kind: "screen", title: "Home" },
    resourceEvidence: views.map(({ viewport, colorScheme, reasons }) => ({
      viewport,
      colorScheme,
      ...(reasons ? { reasons } : {}),
    })),
    components: [],
    comparisonEligible: true,
    comparisons: true,
    inputChanges: [],
    relatedComponents: [],
    usedBy: [],
    affected: [],
    removed: false,
    variants: [],
    views: [],
  } as unknown as WorkspaceData;
}

function componentWorkspace(
  status: "Changed" | "Unmodified",
  rules: Parameters<typeof cssReason>[1],
  id = "action",
): WorkspaceData {
  const address = { path: id, title: id };
  const variantPath = `${id}/default`;
  return {
    base: "main",
    status,
    entry: { path: id, kind: "component", title: id },
    component: { path: id, title: id, kind: "component" },
    change: {
      kind: "component",
      before: address,
      after: address,
      reasons: [cssReason(RULES, rules)],
    },
    comparison: {
      ...address,
      before: address,
      after: address,
      state: "changed",
      variants: [
        {
          path: variantPath,
          title: "Default",
          state: "changed",
          views: [view("mobile", "light", rules)],
        },
      ],
    },
    components: [],
    comparisonEligible: true,
    comparisons: true,
    inputChanges: [],
    relatedComponents: [],
    usedBy: [],
    affected: [],
    removed: false,
    variants: [],
    views: [],
  } as unknown as WorkspaceData;
}

function loadedScreen(views: readonly ViewReview[]) {
  const address = { path: "home", title: "Home" };
  const result: ReviewResultV7 = {
    schemaVersion: 7,
    baseRef: "main",
    baseCommit: "a".repeat(40),
    changedPaths: [RULES],
    ignoredImpact: [],
    screens: [
      { ...address, before: address, after: address, state: "changed", views },
    ],
    components: [],
    changes: [],
    affectedConsumers: [],
  };
  return parseReviewResult(result);
}

function render(
  data: WorkspaceData,
  variantPath?: string,
  loaded?: ReturnType<typeof parseReviewResult>,
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      data,
      ...(variantPath ? { variantPath } : {}),
      ...(loaded ? { loaded } : {}),
    }),
  );
}
