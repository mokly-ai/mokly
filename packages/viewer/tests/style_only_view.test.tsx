/**
 * The style-only rule of the CSS evidence presentation: a changed view reads
 * "Styles this … uses changed" only when every reason of its entry is a
 * dependency, each named path has a rule of any status on this view, and at
 * least one named path has a retained rule on this view.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type {
  ComparedEntry,
  EntryChangeReason,
  ReviewView,
} from "../src/review/types.js";
import { selectedComparisonViews } from "../src/shell/comparison_selection.js";
import { ComparisonViews } from "../src/shell/comparison_views.js";
import type { ComparisonPresentation } from "../src/shell/use_comparison.js";
import { isStyleOnlyView } from "../src/shell/workspace_style_evidence.js";

const SHEET = "static/theme.css";
const OTHER = "static/other.css";
const page = { kind: "entry" } as const;
const rule = (
  stylesheet: string,
  status: "matched" | "unresolved" | "excluded" = "matched",
  owner: { kind: "entry" } | { kind: "component"; path: string } = page,
) => ({
  stylesheet,
  selector: status === "excluded" ? "" : ".theme",
  status,
  owner,
});
const view = (
  rules: ReviewView["rules"],
  state: ReviewView["state"] = "changed",
): ReviewView => ({
  viewport: "mobile",
  colorScheme: "light",
  state,
  ignoredIds: [],
  ...(rules ? { rules } : {}),
});
const dependency = (path: string): EntryChangeReason => ({
  kind: "dependency",
  path,
});

test("only dependency reasons keep a style change; every other kind is ordinary", () => {
  const changed = view([rule(SHEET)]);
  assert.equal(isStyleOnlyView(changed, [dependency(SHEET)]), true);
  const others: readonly EntryChangeReason[] = [
    { kind: "added" },
    { kind: "removed" },
    { kind: "metadata" },
    { kind: "material" },
    { kind: "implementation" },
    { kind: "inputs" },
    { kind: "structure" },
    { kind: "screen", screenPath: "home" },
  ];
  for (const reason of others) {
    assert.equal(isStyleOnlyView(changed, [dependency(SHEET), reason]), false);
    assert.equal(isStyleOnlyView(changed, [reason]), false, reason.kind);
  }
});

test("a named path without a rule on this view keeps the ordinary label", () => {
  const changed = view([rule(SHEET)]);
  assert.equal(
    isStyleOnlyView(changed, [dependency(OTHER), dependency(SHEET)]),
    false,
  );
  assert.equal(
    isStyleOnlyView(view([rule(SHEET, "excluded")]), [dependency(SHEET)]),
    false,
  );
  const image = {
    ...view([rule(SHEET)]),
    resources: [{ path: "static/logo.svg", owner: page }],
  };
  assert.equal(
    isStyleOnlyView(image, [dependency("static/logo.svg"), dependency(SHEET)]),
    false,
  );
  assert.equal(
    isStyleOnlyView(view([rule(SHEET, "unresolved")]), [dependency(SHEET)]),
    true,
  );
  const consumed = view([
    rule(SHEET, "matched", { kind: "component", path: "card" }),
  ]);
  assert.equal(isStyleOnlyView(consumed, [dependency(SHEET)]), true);
});

test("an excluded stylesheet counts while another named stylesheet applies", () => {
  const reasons = [dependency(OTHER), dependency(SHEET)];
  assert.equal(
    isStyleOnlyView(view([rule(OTHER, "excluded"), rule(SHEET)]), reasons),
    true,
  );
  assert.equal(
    isStyleOnlyView(
      view([rule(OTHER, "excluded"), rule(SHEET, "unresolved")]),
      reasons,
    ),
    true,
  );
  assert.equal(
    isStyleOnlyView(
      view([rule(OTHER, "excluded"), rule(SHEET, "excluded")]),
      reasons,
    ),
    false,
  );
});

test("an unchanged view and an entry without a reason keep the ordinary label", () => {
  assert.equal(
    isStyleOnlyView(view([rule(SHEET)], "unchanged"), [dependency(SHEET)]),
    false,
  );
  assert.equal(isStyleOnlyView(view([rule(SHEET)]), []), false);
  assert.equal(isStyleOnlyView(view(undefined), [dependency(SHEET)]), false);
});

const MOBILE: ComparisonPresentation = {
  colorScheme: "light",
  mode: "side",
  requestedColorScheme: "light",
  viewport: "mobile",
};
const MOBILE_DARK: ComparisonPresentation = {
  ...MOBILE,
  colorScheme: "dark",
  requestedColorScheme: "dark",
};

/** The selected mobile heading of one compared entry, as the panes render it. */
function heading(
  entry: ComparedEntry,
  kind: "component" | "screen",
  presentation = MOBILE,
): string | undefined {
  const loaded = {
    url: `https://example.test/mokly-viewer/diffs/generations/${"b".repeat(64)}/`,
  };
  const views = selectedComparisonViews(loaded, presentation, entry);
  const markup = renderToStaticMarkup(
    <ComparisonViews
      entryId={entry.path}
      entryKind={kind}
      presentation={presentation}
      presentations={new Map()}
      together
      views={views}
    />,
  );
  return /<h3 class="mbk-reset">(.*?)<\/h3>/.exec(markup)?.[1];
}

function changedEntry(
  kind: "component" | "screen",
  reasons: EntryChangeReason[],
): ComparedEntry {
  const path = kind === "component" ? "card" : "home";
  const owner = kind === "component" ? { kind, path: "card" } : page;
  return {
    path,
    basePath: path,
    reasons,
    views: [view([rule(SHEET, "matched", owner)])],
  };
}

test("the pane heading takes its noun from the wording of the entry kind", () => {
  assert.equal(
    heading(changedEntry("screen", [dependency(SHEET)]), "screen"),
    "Mobile · Styles this screen uses changed",
  );
  assert.equal(
    heading(changedEntry("component", [dependency(SHEET)]), "component"),
    "Mobile · Styles this variant uses changed",
  );
  assert.equal(
    heading(
      changedEntry("component", [dependency(SHEET), { kind: "metadata" }]),
      "component",
    ),
    "Mobile · Variant changed",
  );
});

test("a variant's heading reads the variant's own reasons, not its parent's", () => {
  const variant: ComparedEntry = {
    path: "card/compact",
    basePath: "card/compact",
    reasons: [dependency(SHEET)],
    views: [
      view([rule(SHEET, "matched", { kind: "component", path: "card" })]),
    ],
  };
  const parent: ComparedEntry = {
    path: "card",
    basePath: "card",
    reasons: [{ kind: "implementation" }],
    views: [view(undefined, "unchanged")],
  };
  assert.equal(
    heading(variant, "component"),
    "Mobile · Styles this variant uses changed",
  );
  assert.equal(
    heading(parent, "component"),
    "Mobile · No changes to this variant",
  );
});

test("a stylesheet for dark views only keeps the style heading on light views", () => {
  const dark = "static/dark.css";
  const entry: ComparedEntry = {
    ...changedEntry("screen", [dependency(dark), dependency(SHEET)]),
    views: [
      view([rule(dark, "excluded"), rule(SHEET)]),
      { ...view([rule(dark), rule(SHEET)]), colorScheme: "dark" },
    ],
  };
  const styles = "Mobile · Styles this screen uses changed";
  assert.equal(heading(entry, "screen"), styles);
  assert.equal(heading(entry, "screen", MOBILE_DARK), styles);
});
