import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BREAKING_VERSIONS,
  RELEASE_ANCHORS,
  anchorTargets,
  only,
  tagged,
} from "./design-site-changelog-helpers";
import {
  attribute,
  byClass,
  cssRules,
  label,
  siteDocument,
  siteStyles,
} from "./design-site-test-helpers";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: each depicted release is a frame labelled Mokly CLI and its version`, () => {
    const { document } = siteDocument("design/site/changelog", viewport);
    const frames = byClass(document, "site-release");
    assert.deepEqual(
      frames.map((frame) => "#" + attribute(frame, "id")),
      RELEASE_ANCHORS,
    );
    assert.deepEqual(
      frames.map((frame) => [
        label(only(tagged(frame, "h2"), "h2")),
        label(only(byClass(frame, "site-frame-name"), "frame label")),
      ]),
      [
        ["Mokly CLI 0.19.0", "v0.19.0 · 12 November 2026"],
        ["Mokly CLI 0.18.0", "v0.18.0 · 1 November 2026"],
        ["Mokly CLI 0.17.0", "v0.17.0 · 29 October 2026"],
        ["Mokly CLI 0.16.1", "v0.16.1 · 26 October 2026"],
        ["Mokly CLI 0.16.0", "v0.16.0 · 25 October 2026"],
        ["Mokly CLI 0.15.0", "v0.15.0 · 12 October 2026"],
        ["Mokly CLI 0.14.0", "v0.14.0 · 8 October 2026"],
        ["Mokly CLI 0.13.0", "v0.13.0 · 30 September 2026"],
        ["Mokly CLI 0.12.0", "v0.12.0 · 22 September 2026"],
        ["Mokly CLI 0.11.0", "v0.11.0 · 17 September 2026"],
        ["Mokly CLI 0.10.0", "v0.10.0 · 17 September 2026"],
        ["Mokly CLI 0.9.0", "v0.9.0 · 15 September 2026"],
      ],
    );
    assert.deepEqual(
      frames.map((frame) => byClass(frame, "site-chip--signal").map(label)),
      [["Latest"], ...frames.slice(1).map(() => [])],
    );
    const newest = frames[0]!;
    const link = only(byClass(newest, "site-release-link"), "release link");
    assert.equal(label(link), "Read release details ↗");
    assert.equal(
      attribute(link, "href"),
      "https://github.com/mokly-ai/mokly/compare/v0.18.0...v0.19.0",
    );
    assert.equal(
      label(only(byClass(newest, "site-release-compare"), "range")),
      "v0.18.0...v0.19.0",
    );
    assert.deepEqual(
      byClass(newest, "site-release-count").map((chip) => [
        label(chip),
        attribute(chip, "href"),
      ]),
      [
        ["Breaking 3", "#release-0-19-0-breaking"],
        ["Features 3", "#release-0-19-0-features"],
        ["Fixes 12", "#release-0-19-0-fixes"],
        ["Performance 3", "#release-0-19-0-performance"],
        ["Refactoring 1", "#release-0-19-0-refactoring"],
      ],
    );
    for (const chip of byClass(document, "site-release-count")) {
      const href = attribute(chip, "href") ?? "";
      assert.equal(anchorTargets(document, href), 1, href);
    }
  });

  test(`${viewport}: the newest frame is selected with its note count`, () => {
    const { document } = siteDocument("design/site/changelog", viewport);
    const frames = byClass(document, "site-release");
    const none = frames.slice(1).map(() => 0);
    assert.deepEqual(
      frames.map((frame) => byClass(frame, "site-sel").length),
      [1, ...none],
    );
    assert.deepEqual(
      frames.map((frame) => byClass(frame, "site-frame-name--selected").length),
      [1, ...none],
    );
    const selection = only(byClass(frames[0]!, "site-sel"), "selection");
    assert.equal(attribute(selection, "aria-hidden"), "true");
    assert.equal(byClass(selection, "site-sel-handle").length, 4);
    assert.equal(
      label(only(byClass(selection, "site-sel-size"), "size")),
      "22 notes",
    );
  });

  test(`${viewport}: breaking changes are a callout pinned to their frame`, () => {
    const { document } = siteDocument("design/site/changelog", viewport);
    const callouts = byClass(document, "site-release-group--breaking");
    assert.deepEqual(
      callouts.map((callout) => attribute(callout, "id")),
      BREAKING_VERSIONS.map(
        (release) => `release-${release.replaceAll(".", "-")}-breaking`,
      ),
    );
    for (const callout of callouts) {
      const pin = only(byClass(callout, "site-release-pin"), "pin");
      assert.equal(attribute(pin, "aria-hidden"), "true");
      assert.equal(
        label(only(byClass(callout, "site-release-group-hint"), "hint")),
        "Read before you upgrade.",
      );
    }
    assert.equal(
      label(only(byClass(callouts[0]!, "site-release-group-title"), "title")),
      "Breaking changes 3",
    );
  });
}

test("a breaking callout is a ringed, tinted box without an edge accent", () => {
  const own = cssRules(siteStyles()).filter((rule) =>
    rule.selector
      .split(",")
      .some((part) => /\.site-release-group--breaking\S*$/.test(part.trim())),
  );
  const box = own.find(
    (rule) => rule.selector.trim() === ".site-release-group--breaking",
  );
  assert.ok(box, ".site-release-group--breaking");
  assert.match(box.declarations, /background:/);
  assert.match(box.declarations, /box-shadow: inset 0 0 0 1px/);
  for (const rule of own) {
    const selector = rule.selector.trim();
    assert.doesNotMatch(selector, /::?(?:before|after)/, selector);
    assert.doesNotMatch(rule.declarations, /border(?!-radius)/, selector);
  }
});
