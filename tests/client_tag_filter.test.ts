import assert from "node:assert/strict";
import test from "node:test";

import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import {
  navLeafVisible,
  navNodeVisible,
  navigationFiltering,
} from "../packages/viewer/dist/shell/nav_model.js";
import type {
  NavGroupNode,
  NavLeafNode,
} from "../packages/viewer/dist/shell/nav_tree.js";
import {
  clearTagTerm,
  parseSearchQuery,
  setTagTerm,
} from "../packages/viewer/dist/shell/search_query.js";
import { defaultSelection } from "../packages/viewer/dist/viewer/selection.js";

const context: ShellContext = {
  base: "",
  changedRoutes: [],
  changesStatus: "ready",
  updateVersion: 0,
};
const welcome = leaf("screens/welcome.html", "Welcome", [
  "forms",
  "onboarding",
]);
const details = leaf("screens/details.html", "Details", ["forms"]);
const glossary = leaf("docs/glossary.html", "Glossary");

test("a tag chip enters its term and filters the catalogue", () => {
  const selection = querySelection(setTagTerm("", "forms"));
  assert.equal(navLeafVisible(welcome, selection, context), true);
  assert.equal(navLeafVisible(details, selection, context), true);
  assert.equal(navLeafVisible(glossary, selection, context), false);
  assert.equal(navigationFiltering(selection), true);
});

test("clicking the active chip clears only its tag term", () => {
  const selected = setTagTerm("welcome tag:forms", "onboarding");
  assert.equal(selected, "welcome tag:onboarding");
  assert.equal(clearTagTerm(selected, "onboarding"), "welcome");
});

test("chip state follows the entered query regardless of case", () => {
  assert.deepEqual(parseSearchQuery("TAG:Onboarding").tags, ["onboarding"]);
  assert.deepEqual(parseSearchQuery("").tags, []);
});

test("selecting one picker tag replaces an older tag and keeps free text", () => {
  assert.equal(
    setTagTerm("welcome tag:onboarding", "forms"),
    "welcome tag:forms",
  );
  assert.deepEqual(parseSearchQuery("welcome tag:forms"), {
    freeText: "welcome",
    tags: ["forms"],
  });
});

test("tag filtering hides groups only when every descendant is hidden", () => {
  const screens = group("Screens", [welcome, details]);
  const docs = group("Docs", [glossary]);
  const selection = querySelection("tag:onboarding");
  assert.equal(navNodeVisible(screens, selection, context), true);
  assert.equal(navNodeVisible(docs, selection, context), false);
});

test("clearing the last tag restores unconstrained navigation", () => {
  const selection = querySelection(clearTagTerm("tag:forms", "forms"));
  assert.equal(navigationFiltering(selection), false);
  assert.equal(navLeafVisible(glossary, selection, context), true);
});

function querySelection(raw: string) {
  const query = parseSearchQuery(raw);
  return {
    ...defaultSelection,
    search: query.freeText,
    tags: query.tags,
  };
}

function leaf(
  route: string,
  label: string,
  tags: readonly string[] = [],
): NavLeafNode {
  return {
    entryKind: "screen",
    key: `entry:${route}`,
    kind: "leaf",
    label,
    route,
    tags,
  };
}

function group(label: string, children: NavLeafNode[]): NavGroupNode {
  return {
    children,
    key: `folder:${label.toLowerCase()}`,
    kind: "group",
    label,
  };
}
