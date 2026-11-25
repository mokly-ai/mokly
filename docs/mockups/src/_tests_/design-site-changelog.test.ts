import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BREAKING_VERSIONS,
  RELEASE_ANCHORS,
  anchorTargets,
  hasClass,
  only,
  tagged,
} from "./design-site-changelog-helpers";
import {
  assertHoverChangesMoreThanColor,
  attribute,
  byClass,
  label,
  siteDocument,
  siteStyles,
  type Element,
} from "./design-site-test-helpers";

/** The changelog's controls, each of which promises a hover state. */
const hoverClasses = [
  "site-release-index-link",
  "site-changelog-filter-option",
  "site-release-count",
  "site-release-ref",
  "site-release-upgrade-summary",
];

test("desktop: Version history lists each depicted release by month, linked to its frame", () => {
  const { document } = siteDocument("design/site/changelog", "desktop");
  const panel = only(byClass(document, "site-release-index"), "panel");
  assert.equal(panel.tagName, "nav");
  assert.equal(attribute(panel, "aria-label"), "Version history");
  assert.equal(label(only(byClass(panel, "site-panel-meta"), "count")), "12");
  assert.deepEqual(byClass(panel, "site-release-index-month").map(label), [
    "November 2026",
    "October 2026",
    "September 2026",
  ]);
  const rows = byClass(panel, "site-release-index-link");
  assert.deepEqual(
    rows.map((row) => row.tagName),
    RELEASE_ANCHORS.map(() => "a"),
  );
  const version = (row: Element) =>
    label(only(byClass(row, "site-release-index-version"), "version"));
  assert.deepEqual(
    rows.map((row) => attribute(row, "href")),
    RELEASE_ANCHORS,
  );
  for (const anchor of RELEASE_ANCHORS)
    assert.equal(anchorTargets(document, anchor), 1, anchor);
  assert.deepEqual(
    rows.map((row) => [
      version(row),
      label(only(byClass(row, "site-panel-row-trail"), "date")),
    ]),
    [
      ["v0.19.0", "12 Nov"],
      ["v0.18.0", "1 Nov"],
      ["v0.17.0", "29 Oct"],
      ["v0.16.1", "26 Oct"],
      ["v0.16.0", "25 Oct"],
      ["v0.15.0", "12 Oct"],
      ["v0.14.0", "8 Oct"],
      ["v0.13.0", "30 Sep"],
      ["v0.12.0", "22 Sep"],
      ["v0.11.0", "17 Sep"],
      ["v0.10.0", "17 Sep"],
      ["v0.9.0", "15 Sep"],
    ],
  );
  assert.deepEqual(
    rows
      .filter((row) => byClass(row, "site-release-index-mark").length === 1)
      .map(version),
    BREAKING_VERSIONS.map((release) => "v" + release),
  );
  assert.deepEqual(
    rows
      .filter((row) => attribute(row, "aria-current") === "true")
      .map(version),
    ["v0.19.0"],
  );
  assert.deepEqual(
    rows
      .filter((row) => hasClass(row, "site-release-index-link--current"))
      .map(version),
    ["v0.19.0"],
  );
  const foot = only(byClass(panel, "site-panel-foot"), "foot");
  assert.equal(label(foot), "Atom feed");
  assert.equal(tagged(foot, "a").length, 0, "the Atom feed is plain text");
});

test("mobile: the changelog draws no Version history panel", () => {
  const { document } = siteDocument("design/site/changelog", "mobile");
  assert.equal(byClass(document, "site-release-index").length, 0);
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the page title is a selected text layer`, () => {
    const { document } = siteDocument("design/site/changelog", viewport);
    const layer = only(byClass(document, "site-changelog-heading"), "layer");
    assert.equal(label(only(tagged(layer, "h1"), "h1")), "What’s new in Mokly");
    const selection = only(byClass(layer, "site-sel"), "selection");
    assert.equal(attribute(selection, "aria-hidden"), "true");
    assert.equal(byClass(selection, "site-sel-handle").length, 8);
    assert.equal(
      label(only(byClass(selection, "site-sel-name"), "name")),
      "Heading",
    );
    assert.deepEqual(
      byClass(selection, "site-sel-badge").map(label),
      viewport === "desktop" ? ["Geist Semibold 96"] : [],
    );
    assert.equal(byClass(selection, "site-sel-size").length, 1);
  });

  test(`${viewport}: the timeline draws a keyframe for each release on at most three lanes`, () => {
    const { document } = siteDocument("design/site/changelog", viewport);
    const timeline = only(
      byClass(document, "site-changelog-timeline"),
      "timeline",
    );
    assert.equal(attribute(timeline, "aria-hidden"), "true");
    assert.deepEqual(
      byClass(timeline, "site-changelog-tick--month").map(label),
      ["Sep", "Oct", "Nov"],
    );
    const keys = byClass(
      only(byClass(timeline, "site-changelog-keys"), "keys"),
      "site-changelog-key",
    );
    assert.equal(keys.length, RELEASE_ANCHORS.length);
    const kind = (modifier: string) =>
      keys.filter((key) => hasClass(key, "site-changelog-key--" + modifier))
        .length;
    assert.deepEqual(
      [kind("breaking"), kind("patch"), kind("current")],
      [BREAKING_VERSIONS.length, 1, 1],
    );
    const lanes = new Set(
      keys.map((key) => /top:(\d+)px/.exec(attribute(key, "style") ?? "")?.[1]),
    );
    assert.deepEqual(
      [...lanes].sort(),
      viewport === "desktop" ? ["16", "34"] : ["16", "34", "52"],
    );
    assert.equal(
      label(only(byClass(timeline, "site-changelog-playhead"), "playhead")),
      "v0.19.0",
    );
  });

  test(`${viewport}: the filter offers all notes and four groups with their counts`, () => {
    const { document } = siteDocument("design/site/changelog", viewport);
    const filter = only(byClass(document, "site-changelog-filter"), "filter");
    assert.equal(filter.tagName, "fieldset");
    assert.equal(attribute(filter, "aria-label"), "Show notes");
    assert.deepEqual(
      tagged(filter, "input").map((input) => [
        attribute(input, "type"),
        attribute(input, "name"),
        attribute(input, "value"),
        attribute(input, "checked") !== undefined,
      ]),
      [
        ["radio", "site-changelog-filter", "all", true],
        ["radio", "site-changelog-filter", "breaking", false],
        ["radio", "site-changelog-filter", "features", false],
        ["radio", "site-changelog-filter", "fixes", false],
        ["radio", "site-changelog-filter", "performance", false],
      ],
    );
    assert.deepEqual(
      byClass(filter, "site-changelog-filter-option").map(label),
      ["All 189", "Breaking 25", "Features 65", "Fixes 74", "Performance 18"],
    );
    assert.equal(
      label(only(byClass(document, "site-changelog-filter-status"), "status")),
      "189 notes in 12 releases",
    );
  });
}

test("every promised changelog control changes more than color on hover", () => {
  assertHoverChangesMoreThanColor(hoverClasses, "design/site/changelog");
});

test("split site styles own the changelog compositions", () => {
  assert.ok(
    siteStyles("design/site/changelog").includes(".site-release {"),
    ".site-release",
  );
});
