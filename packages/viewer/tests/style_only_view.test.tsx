/**
 * The style-only rule of the CSS evidence presentation: a changed view reads
 * "Styles this … uses changed" only when every reason of its entry is a
 * dependency and each named path has a retained rule on this view.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { parseReviewResult } from "../src/review/result_validation.js";
import type {
  EntryChangeReason,
  ReviewEntry,
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

test("a named path without a retained rule on this view keeps the ordinary label", () => {
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

/**
 * The selected mobile heading of one loaded entry, as the panes render it,
 * on the entry's own route or the route of a variant it groups.
 */
function heading(entry: ReviewEntry, route = entry.path): string | undefined {
  const result = parseReviewResult({
    schemaVersion: 8,
    baseCommit: "a".repeat(40),
    entries: [entry],
    affected: [],
    diagnostics: [],
  });
  const kind = entry.kind === "component" ? "component" : "screen";
  const loaded = {
    result,
    url: `https://example.test/mokly-viewer/diffs/generations/${"b".repeat(64)}/review.json`,
  };
  const views = selectedComparisonViews(loaded, MOBILE, kind, route);
  const markup = renderToStaticMarkup(
    <ComparisonViews
      entryId={route}
      entryKind={kind}
      presentation={MOBILE}
      presentations={new Map()}
      together
      views={views}
    />,
  );
  return /<h3>(.*?)<\/h3>/.exec(markup)?.[1];
}

function changedEntry(
  kind: "component" | "screen",
  reasons: EntryChangeReason[],
): ReviewEntry {
  const side = {
    path: kind === "component" ? "card" : "home",
    title: kind === "component" ? "Card" : "Home",
    props: {},
    ...(kind === "component" ? { suppliedSlots: [] } : {}),
  };
  const owner = kind === "component" ? { kind, path: "card" } : page;
  return {
    kind,
    path: side.path,
    title: side.title,
    before: side,
    after: side,
    state: "changed",
    included: true,
    reasons,
    views: [view([rule(SHEET, "matched", owner)])],
    ...(kind === "component" ? { variants: [] } : {}),
  };
}

test("the pane heading takes its noun from the wording of the entry kind", () => {
  assert.equal(
    heading(changedEntry("screen", [dependency(SHEET)])),
    "Mobile · Styles this screen uses changed",
  );
  assert.equal(
    heading(changedEntry("component", [dependency(SHEET)])),
    "Mobile · Styles this variant uses changed",
  );
  assert.equal(
    heading(
      changedEntry("component", [dependency(SHEET), { kind: "metadata" }]),
    ),
    "Mobile · Variant changed",
  );
});

test("a variant's heading reads the variant's own reasons, not its parent's", () => {
  const side = (path: string, title: string) => ({
    path,
    title,
    props: {},
    suppliedSlots: [],
  });
  const variant: ReviewEntry = {
    kind: "component",
    path: "card/compact",
    title: "Compact",
    before: side("card/compact", "Compact"),
    after: side("card/compact", "Compact"),
    state: "changed",
    included: true,
    reasons: [dependency(SHEET)],
    views: [
      view([rule(SHEET, "matched", { kind: "component", path: "card" })]),
    ],
  };
  const parent: ReviewEntry = {
    kind: "component",
    path: "card",
    title: "Card",
    before: side("card", "Card"),
    after: side("card", "Card"),
    state: "unchanged",
    included: true,
    reasons: [{ kind: "implementation" }],
    views: [view(undefined, "unchanged")],
    variants: [variant],
  };
  assert.equal(
    heading(parent, "card/compact"),
    "Mobile · Styles this variant uses changed",
  );
});
