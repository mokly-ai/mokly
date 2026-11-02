import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  ResourceEvidence,
  RuleEvidence,
} from "../packages/viewer/dist/catalogue/types.js";
import type {
  ComparedEntry,
  EntryChangeReason,
  ReviewView,
} from "../packages/viewer/dist/review/types.js";
import { viewEvidenceReasons } from "../packages/viewer/dist/review/view_evidence.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";

const SHARED = "static/shared.css";
const UNUSED = "static/unused.css";
const page = { kind: "entry" } as const;
const rule = (
  stylesheet: string,
  selector: string,
  status: RuleEvidence["status"] = "matched",
): RuleEvidence => ({ stylesheet, selector, status, owner: page });
const resource = (path: string): ResourceEvidence => ({ path, owner: page });
const dependency = (path: string): EntryChangeReason => ({
  kind: "dependency",
  path,
});

test("loaded comparison details merge with classification, deduplicate selectors and suppress retained exclusions", () => {
  const data = workspace();
  data.resourceEvidence = [
    {
      viewport: "mobile",
      colorScheme: "light",
      ...viewEvidenceReasons({
        rules: [rule(SHARED, ".auth"), rule(UNUSED, "", "excluded")],
        resources: [],
      }),
    },
  ];
  data.reasons = [dependency(SHARED), dependency(UNUSED)];
  data.compared = compared(data.reasons, {
    ignoredIds: ["chrome"],
    rules: [
      rule(SHARED, ".auth"),
      rule(SHARED, ".global", "unresolved"),
      rule(UNUSED, ".saved"),
    ],
  });
  const markup = renderEvidence(data, true);
  assert.match(markup, /Changed styles that apply to this screen:/);
  assert.match(markup, /This change can apply anywhere on the screen/);
  for (const selector of [".auth", ".global", ".saved"])
    assert.equal(markup.split(`>${selector}</code>`).length - 1, 1);
  assert.equal(
    markup.split(`<li class="mbk-reset">${SHARED}<p class="mbk-reset">`)
      .length - 1,
    1,
  );
  assert.match(markup, /Excluded content: chrome/);
  assert.doesNotMatch(markup, /Examined and excluded|Shared component changes/);
  assert.equal(
    markup.split('<h3 class="mbk-reset">Comparison details</h3>').length - 1,
    1,
  );
  assert.equal(renderEvidence(data, true), markup);
});

test("loaded view resources remain visible without classification", () => {
  const data = workspace();
  delete data.status;
  data.compared = compared([dependency("static/loaded.svg")], {
    resources: [resource("static/loaded.svg")],
  });
  const markup = renderEvidence(data, true);
  assert.doesNotMatch(markup, / hidden=/);
  assert.match(markup, /static\/loaded\.svg/);
  assert.doesNotMatch(markup, /Shared component changes/);
});

test("compared views add evidence only once the routed entry's comparison loads", () => {
  const data = workspace();
  data.compared = compared([dependency("static/logo.svg")], {
    resources: [resource("static/logo.svg")],
  });
  assert.doesNotMatch(renderEvidence(data), /static\/logo\.svg/);
  assert.match(renderEvidence(data, true), /static\/logo\.svg/);
  delete data.compared;
  assert.doesNotMatch(renderEvidence(data, true), /static\/logo\.svg/);
});

test("workspace evidence keeps excluded stylesheets separate", () => {
  const data = workspace();
  data.status = "Unmodified";
  data.resourceEvidence = (["mobile", "desktop"] as const).map((viewport) => ({
    viewport,
    colorScheme: "light",
    ...viewEvidenceReasons({
      rules: [rule(UNUSED, "", "excluded")],
      resources: [],
    }),
  }));
  data.compared = compared([], { state: "unchanged" }, ["mobile", "desktop"]);

  const markup = renderEvidence(data, true);
  assert.doesNotMatch(markup, /Changes to these files may affect this screen:/);
  assert.match(
    markup,
    /Examined and excluded:<\/p><ul class="mbk-reset"><li class="mbk-reset">static\/unused\.css<\/li><\/ul>/,
  );
  assert.doesNotMatch(markup, /Changed styles that apply to this screen/);
});

test("loaded evidence lists a resource that several views keep once", () => {
  const beta = "static/beta.svg";
  const data = workspace();
  data.compared = compared(
    [dependency(beta)],
    { resources: [resource(beta)] },
    ["mobile", "desktop"],
  );
  const markup = renderEvidence(data, true);

  assert.match(
    markup,
    /Changes to these files may affect this screen:<\/p><ul class="mbk-evidence-files mbk-reset"><li class="mbk-reset">static\/beta\.svg<\/li><\/ul>/,
  );
  assert.equal(
    markup.split(`<li class="mbk-reset">${beta}</li>`).length - 1,
    1,
  );
});

function renderEvidence(data: WorkspaceData, loaded = false): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, { compared: loaded, data }),
  );
}

/** The routed screen `home`'s comparison facts, whose light views share one record shape. */
function compared(
  reasons: readonly EntryChangeReason[],
  shape: Partial<ReviewView> = {},
  viewports: readonly ("mobile" | "desktop")[] = ["mobile"],
): ComparedEntry {
  const views = viewports.map((viewport): ReviewView => ({
    ignoredIds: [],
    ...structuredClone(shape),
    viewport,
    colorScheme: "light",
    state: shape.state ?? "changed",
  }));
  return { path: "home", basePath: "home", reasons, views };
}

function workspace(): WorkspaceData {
  return {
    base: "main",
    changedViews: { home: [] },
    viewStates: {},
    status: "Changed",
    comparisons: true,
    comparisonEligible: true,
    affectedComparison: false,
    entry: {
      colorSchemes: ["light"],
      path: "home",
      kind: "screen",
      title: "Home",
      details: {
        description: "Home",
        relatedDocs: [],
        sourcePath: "entries/home.mockup.tsx",
      },
      detailId: "a".repeat(64),
      changes: { status: "ready", kind: "changed", included: true },
      tags: [],
      propSchema: { type: "object", additionalProperties: false },
      props: {},
      controls: {},
      views: [],
      useCasePaths: [],
    },
    components: [],
    views: [],
    variants: [],
    usedBy: [],
    affected: [],
    removed: false,
    relatedComponents: [],
    inputChanges: [],
  };
}
