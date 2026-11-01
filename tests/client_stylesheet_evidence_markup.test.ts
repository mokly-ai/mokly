import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  COMPONENT_STYLE_COPY,
  SCREEN_STYLE_COPY,
} from "../examples/basic/specs/design/parts/stylesheet_evidence.js";
import type { RuleEvidence } from "../packages/viewer/dist/catalogue/types.js";
import type {
  ComparedEntry,
  ReviewView,
  ViewResourceEvidence,
} from "../packages/viewer/dist/review/types.js";
import { viewEvidenceReasons } from "../packages/viewer/dist/review/view_evidence.js";
import { entryWording } from "../packages/viewer/dist/shell/entry_wording.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";

import { cssReason, cssRule } from "./helpers/css_evidence.js";

const RULES = "static/rule.css";
const action = { kind: "component", path: "action" } as const;
/** One review v8 rule record of the changed stylesheet. */
const rule = (
  selector: string,
  owner: RuleEvidence["owner"] = { kind: "entry" },
  status: RuleEvidence["status"] = "matched",
): RuleEvidence => ({ stylesheet: RULES, selector, status, owner });
/** `.heading` also matches outside the changed component it styles. */
const outsideRules = [
  rule(".action", action),
  rule(".heading", action),
  rule(".heading"),
];
const componentRules = [rule(".action", action)];

test("a screen's changed file holds its outside sentence and styles, as the mockup does", () => {
  const data = screenWorkspace([evidence("mobile", "light", outsideRules)]);
  const markup = render(data);
  assert.ok(
    markup.includes(
      `<p class="mbk-reset">${SCREEN_STYLE_COPY.files}</p>` +
        `<ul class="mbk-evidence-files mbk-reset"><li class="mbk-reset">${RULES}` +
        `<p class="mbk-reset">${SCREEN_STYLE_COPY.outside}</p>` +
        '<ul class="mbk-reset"><li class="mbk-reset"><code class="mbk-code mbk-reset">.heading</code></li></ul>' +
        "</li></ul>",
    ),
    markup,
  );
  assert.doesNotMatch(markup, />\.action</);
  assert.doesNotMatch(markup, /selector:/);
});

test("a component's own page keeps the mockup's matched-component sentence", () => {
  const data = componentWorkspace("Changed", componentRules);
  const markup = render(data, "action/default");
  assert.ok(
    markup.includes(
      `<p class="mbk-reset">${COMPONENT_STYLE_COPY.files}</p>` +
        `<ul class="mbk-evidence-files mbk-reset"><li class="mbk-reset">${RULES}` +
        `<p class="mbk-reset">${COMPONENT_STYLE_COPY.matched}</p>` +
        '<ul class="mbk-reset"><li class="mbk-reset"><code class="mbk-code mbk-reset">.action</code></li></ul>' +
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
      '<li class="mbk-reset">mockups/mokly-generated/styles/entries/a&amp;b.mockup.tsx.css<p class="mbk-reset">',
    ),
    markup,
  );
  assert.ok(
    markup.includes(
      '<code class="mbk-code mbk-reset">[aria-label=&quot;&lt;tip&gt;&quot;]</code>',
    ),
  );
});

test("classification and a loaded comparison merge into one file and one paragraph", () => {
  const data = screenWorkspace([evidence("mobile", "light", outsideRules)]);
  data.reasons = [{ kind: "dependency", path: RULES }];
  data.compared = screenEntry([view("mobile", "light", outsideRules)]);
  const markup = render(data, undefined, true);
  assert.equal(
    markup.split(`<li class="mbk-reset">${RULES}<p class="mbk-reset">`).length -
      1,
    1,
  );
  assert.equal(markup.split(SCREEN_STYLE_COPY.outside).length - 1, 1);
  assert.equal(markup.split(">.heading</code>").length - 1, 1);
});

test("Details read the same facts whatever viewport or scheme is shown", () => {
  const data = screenWorkspace([
    evidence("mobile", "light", outsideRules),
    evidence("desktop", "dark", [
      rule(".tone", { kind: "entry" }, "unresolved"),
    ]),
  ]);
  const markup = render(data);
  assert.ok(
    markup.includes(
      `<p class="mbk-reset">${SCREEN_STYLE_COPY.outside}</p>` +
        '<ul class="mbk-reset"><li class="mbk-reset"><code class="mbk-code mbk-reset">.heading</code></li></ul>' +
        `<p class="mbk-reset">${SCREEN_STYLE_COPY.unresolved}</p>` +
        '<ul class="mbk-reset"><li class="mbk-reset"><code class="mbk-code mbk-reset">.tone</code></li></ul>',
    ),
    markup,
  );
});

test("a consuming component shows its live view evidence before any comparison loads", () => {
  const data = componentWorkspace("Unmodified", componentRules, "toolbar");
  data.included = false;
  data.relatedComponents = [{ path: "action", title: "Action" }];
  data.variants = savedViews("toolbar/default", "Unmodified");
  const markup = render(data, "toolbar/default");
  assert.match(
    markup,
    /<li class="mbk-reset">static\/rule\.css<p class="mbk-reset">Changed styles that apply to this component:<\/p>/,
  );
  assert.ok(
    markup.endsWith(
      `<p class="mbk-reset">${COMPONENT_STYLE_COPY.sharedImpact}</p></section>`,
    ),
    markup,
  );
  assert.doesNotMatch(markup, /No changes to this variant\./);
});

test("the shared-component pane headings follow the design copy", () => {
  assert.equal(
    entryWording("screen").componentsChanged,
    SCREEN_STYLE_COPY.componentsChanged,
  );
  assert.equal(
    entryWording("component").componentsChanged,
    COMPONENT_STYLE_COPY.componentsChanged,
  );
});

test("a parent route closes with the selected saved view's own status", () => {
  const data = componentWorkspace("Unmodified", [rule(".frame")]);
  data.variants = savedViews("action/default", "Changed");
  const markup = render(data, "action/default");
  assert.match(markup, /Changed styles that apply to this variant:/);
  assert.doesNotMatch(markup, /No changes to this variant\./);
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

/** The entry detail's evidence of one view, as the shell presents it. */
function evidence(
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
  rules: readonly RuleEvidence[],
): ViewResourceEvidence {
  return {
    viewport,
    colorScheme,
    ...viewEvidenceReasons({ rules: [...rules], resources: [] }),
  };
}

function view(
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
  rules: readonly RuleEvidence[],
): ReviewView {
  return {
    viewport,
    colorScheme,
    state: "changed",
    ignoredIds: [],
    rules: [...rules],
  };
}

function screenWorkspace(
  resourceEvidence: readonly ViewResourceEvidence[],
): WorkspaceData {
  return {
    base: "main",
    status: "Changed",
    entry: { path: "home", kind: "screen", title: "Home" },
    resourceEvidence,
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

/**
 * A component workspace whose shown saved view keeps these rule records in
 * its entry detail, the evidence a route shows before any comparison loads.
 */
function componentWorkspace(
  status: "Changed" | "Unmodified",
  rules: readonly RuleEvidence[],
  id = "action",
): WorkspaceData {
  return {
    base: "main",
    status,
    entry: { path: id, kind: "component", title: id },
    component: { path: id, title: id, kind: "component" },
    reasons: [{ kind: "dependency", path: RULES }],
    resourceEvidence: [evidence("mobile", "light", rules)],
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

/** The screen `home`'s compared views, changed by the stylesheet they keep. */
function screenEntry(views: ReviewView[]): ComparedEntry {
  return {
    path: "home",
    basePath: "home",
    reasons: [{ kind: "dependency", path: RULES }],
    views,
  };
}

function render(
  data: WorkspaceData,
  variantPath?: string,
  compared = false,
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      compared,
      data,
      ...(variantPath ? { variantPath } : {}),
    }),
  );
}
