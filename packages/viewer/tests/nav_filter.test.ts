/**
 * The Changes filter and the status line under Changes, under the catalogue
 * navigation rules of `docs/protocol/mokly-shell-design-navigation.md`: a
 * spinner replaces the count until detection is ready, selected Changes shows
 * one message in place of rows, and All never shows the message.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { NavigationSection } from "@mokly/ui/catalogue-tree";

import type { NavigationContext } from "../src/shell/context.js";
import { navFilter, navStatus } from "../src/shell/nav_filter.js";
import type { NavigationSelection } from "../src/shell/nav_model.js";

/** A section of the catalogue tree, shown or hidden by the filters. */
function section(hidden: boolean): NavigationSection {
  return {
    disclosure: "specs",
    hidden,
    id: "specs",
    label: "Specs",
    open: true,
    rows: [],
  };
}

/** The selection of the Changes filter, or of All, with `search`. */
function selection(
  view: NavigationSelection["view"],
  search = "",
): NavigationSelection {
  return { search, tags: [], view };
}

const HIDDEN = [section(true)];

test("a catalogue without Changes has no filter", () => {
  assert.equal(navFilter({}, "all"), undefined);
});

test("the filter has no count until detection is ready, then counts the changed entries", () => {
  assert.deepEqual(navFilter({ changesStatus: "pending" }, "changes"), {
    count: undefined,
    status: "pending",
    view: "changes",
  });
  assert.deepEqual(
    navFilter({ changedEntries: ["screens/consumer"] }, "changes"),
    { count: 1, status: "ready", view: "changes" },
  );
});

test("selected Changes without rows names the state of detection", () => {
  const cases: [string, NavigationContext, string, string][] = [
    ["pending", { changesStatus: "pending" }, "", "pending"],
    ["preparing", { changesStatus: "preparing" }, "", "preparing"],
    ["unavailable", { changesStatus: "unavailable" }, "", "unavailable"],
    ["no changes", { changedEntries: [] }, "", "none"],
    [
      "no match for the search",
      { changedEntries: ["screens/consumer"] },
      "Consumer",
      "unmatched",
    ],
  ];
  for (const [name, context, search, message] of cases)
    assert.deepEqual(
      navStatus(context, selection("changes", search), HIDDEN),
      { hidden: false, message },
      name,
    );
});

test("rows in Changes, or the All filter, hide the status line", () => {
  assert.equal(
    navStatus({ changedEntries: ["screens/consumer"] }, selection("changes"), [
      section(false),
    ])?.hidden,
    true,
  );
  for (const context of [
    { changesStatus: "pending" },
    { changesStatus: "unavailable" },
    { changedEntries: [] },
  ] satisfies NavigationContext[])
    assert.equal(
      navStatus(context, selection("all"), HIDDEN)?.hidden,
      true,
      JSON.stringify(context),
    );
});
