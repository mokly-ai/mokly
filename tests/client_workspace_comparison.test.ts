import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  ResourceEvidence,
  RuleEvidence,
} from "../packages/viewer/dist/catalogue/types.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type {
  EntryChangeReason,
  ReviewEntry,
  ReviewResult,
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
  const loaded = parseReviewResult(
    review("home", [dependency(SHARED), dependency(UNUSED)], {
      ignoredIds: ["chrome"],
      rules: [
        rule(SHARED, ".auth"),
        rule(SHARED, ".global", "unresolved"),
        rule(UNUSED, ".saved"),
      ],
    }),
  );
  const markup = renderEvidence(data, loaded);
  assert.match(markup, /Changed styles that apply to this screen:/);
  assert.match(markup, /This change can apply anywhere on the screen/);
  for (const selector of [".auth", ".global", ".saved"])
    assert.equal(markup.split(`>${selector}</code>`).length - 1, 1);
  assert.equal(markup.split(`<li>${SHARED}<p>`).length - 1, 1);
  assert.match(markup, /Excluded content: chrome/);
  assert.doesNotMatch(markup, /Examined and excluded|Shared component changes/);
  assert.equal(markup.split("<h3>Comparison details</h3>").length - 1, 1);
  assert.equal(renderEvidence(data, loaded), markup);
});

test("loaded view resources remain visible without classification", () => {
  const data = workspace();
  delete data.status;
  const loaded = parseReviewResult(
    review("home", [dependency("static/loaded.svg")], {
      resources: [resource("static/loaded.svg")],
    }),
  );
  const markup = renderEvidence(data, loaded);
  assert.doesNotMatch(markup, / hidden=/);
  assert.match(markup, /static\/loaded\.svg/);
  assert.doesNotMatch(markup, /Shared component changes/);
});

test("loaded comparisons for another screen cannot add evidence to the selected workspace", () => {
  const loaded = parseReviewResult(
    review("other", [dependency("static/logo.svg")], {
      resources: [resource("static/logo.svg")],
    }),
  );
  assert.doesNotMatch(renderEvidence(workspace(), loaded), /static\/logo\.svg/);
});

test("a private source path never reaches Details as evidence", () => {
  for (const path of ["entries/renderer.ts", "mockups/shared.css"])
    assert.throws(
      () =>
        parseReviewResult(
          review("home", [dependency(path)], { resources: [resource(path)] }),
        ),
      /review/,
    );
});

test("workspace evidence keeps excluded stylesheets separate", () => {
  const data = workspace();
  data.status = "Unmodified";
  const excluded: Partial<ReviewView> = {
    state: "unchanged",
    rules: [rule(UNUSED, "", "excluded")],
  };
  data.comparison = review("home", [], excluded, [
    "mobile",
    "desktop",
  ]).entries[0]!;
  const loaded = parseReviewResult(
    review("home", [], { state: "unchanged" }, ["mobile", "desktop"]),
  );

  const markup = renderEvidence(data, loaded);
  assert.doesNotMatch(markup, /Changes to these files may affect this screen:/);
  assert.match(
    markup,
    /Examined and excluded:<\/p><ul><li>static\/unused\.css<\/li><\/ul>/,
  );
  assert.doesNotMatch(markup, /Changed styles that apply to this screen/);
});

test("loaded evidence lists a resource that several views keep once", () => {
  const beta = "static/beta.svg";
  const loaded = parseReviewResult(
    review("home", [dependency(beta)], { resources: [resource(beta)] }, [
      "mobile",
      "desktop",
    ]),
  );
  const markup = renderEvidence(workspace(), loaded);

  assert.match(
    markup,
    /Changes to these files may affect this screen:<\/p><ul class="mbk-evidence-files"><li>static\/beta\.svg<\/li><\/ul>/,
  );
  assert.equal(markup.split(`<li>${beta}</li>`).length - 1, 1);
});

function renderEvidence(
  data: WorkspaceData,
  loaded?: ReturnType<typeof parseReviewResult>,
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      data,
      ...(loaded ? { loaded } : {}),
    }),
  );
}

/** A one-screen review v8 result whose light views share one record shape. */
function review(
  path: string,
  reasons: EntryChangeReason[],
  shape: Partial<ReviewView> = {},
  viewports: readonly ("mobile" | "desktop")[] = ["mobile"],
): ReviewResult {
  const side = { path, title: "Home", props: {} };
  const state = shape.state ?? "changed";
  const views = viewports.map((viewport): ReviewView => ({
    ignoredIds: [],
    ...structuredClone(shape),
    viewport,
    colorScheme: "light",
    state,
  }));
  const entry: ReviewEntry = {
    kind: "screen",
    path,
    title: "Home",
    before: side,
    after: side,
    state,
    included: reasons.length > 0,
    reasons,
    views,
  };
  return {
    schemaVersion: 8,
    baseCommit: "a".repeat(40),
    entries: [entry],
    affected: [],
    diagnostics: [],
  };
}

function workspace(): WorkspaceData {
  return {
    base: "main",
    changedViews: { home: [] },
    viewStates: {},
    status: "Changed",
    comparisons: true,
    comparisonEligible: true,
    entry: {
      colorSchemes: ["light"],
      path: "home",
      kind: "screen",
      title: "Home",
      description: "Home",
      relatedDocs: [],

      sourcePath: "entries/home.mockup.tsx",
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
