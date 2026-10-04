import assert from "node:assert/strict";
import test from "node:test";

import { parse, serialize } from "parse5";

import { ComponentValidationError } from "@mokly/viewer/data";

import { stripComponentMarkers } from "../dist/components/comparison_material.js";
import { validateComponentRanges } from "../dist/components/ranges.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { compareUnchangedComponentView } from "../dist/review/component_view_fast_path.js";
import { componentCssDocuments } from "../dist/review/css/containment.js";
import { normalizeReviewPair } from "../dist/review/ignore.js";

import {
  emptyUsage,
  formerMarkers,
  markerView,
} from "./helpers/former_marker_fixture.js";

for (const [name, literal] of formerMarkers) {
  const html = `<html><head></head><body><script>const sample = ${JSON.stringify(literal)};</script><p>Page</p></body></html>`;

  test(`complete comparison preserves unchanged former ${name} spelling in script text`, async () => {
    const { context, view } = markerView(html);
    const result = await compareComponentView(
      { ...context, useFastPath: false },
      view,
      view,
    );
    assert.equal(result.comparisonPath, "complete");
    assert.equal(result.view.state, "unchanged");
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.view.ignoredIds, []);
  });

  test(`fast comparison preserves unchanged former ${name} spelling in script text`, async () => {
    const { context, view } = markerView(html);
    const result = await compareUnchangedComponentView(
      context,
      view,
      view,
      {
        viewport: "mobile",
        colorScheme: "light",
        state: "removed",
        ignoredIds: [],
      },
      html,
      html,
    );
    assert.equal(result.comparison?.comparisonPath, "fast");
    assert.equal(result.comparison.view.state, "unchanged");
    assert.deepEqual(result.comparison.reasons, []);
  });

  test(`CSS containment preserves former ${name} spelling in script text`, () => {
    const pair = componentCssDocuments(html, html, "screens/plain.mobile.html");
    assert.equal(serialize(pair.before!), serialize(parse(html)));
    assert.equal(serialize(pair.after!), serialize(parse(html)));
    assert.deepEqual(pair.ranges?.get(pair.before!), []);
    assert.deepEqual(pair.ranges?.get(pair.after!), []);
  });
}

const comments = [
  [
    "component",
    "<!--mokabook-component:start:r-0--><p>Page</p><!--mokabook-component:end:r-0-->",
  ],
  [
    "ignore",
    "<!--mokabook-review-ignore:start:sample--><p>Page</p><!--mokabook-review-ignore:end:sample-->",
  ],
  [
    "material",
    `<!--mokabook-review-material:sample:${"a".repeat(64)}--><p>Page</p>`,
  ],
] as const;

for (const [name, content] of comments) {
  const html = `<html><head></head><body>${content}</body></html>`;

  test(`former ${name} comments are ordinary content on both comparison sides`, async () => {
    const usage = emptyUsage();
    assert.deepEqual(validateComponentRanges(html, []), []);
    assert.equal(stripComponentMarkers(html), html);
    assert.deepEqual(normalizeReviewPair(html, html, "plain"), {
      base: html,
      head: html,
      ignoredIds: [],
    });
    const { context, view } = markerView(html, html, usage);
    for (const useFastPath of [false, true]) {
      const result = await compareComponentView(
        { ...context, useFastPath },
        view,
        view,
      );
      assert.equal(result.view.state, "unchanged");
      assert.deepEqual(result.reasons, []);
    }
    const pair = componentCssDocuments(html, html, "plain", usage, usage);
    assert.equal(serialize(pair.before!), serialize(parse(html)));
    assert.equal(serialize(pair.after!), serialize(parse(html)));
    assert.deepEqual(pair.ranges?.get(pair.before!), []);
    assert.deepEqual(pair.ranges?.get(pair.after!), []);
  });
}

test("former ignore comments do not hide changed content", async () => {
  const before = `<html><body>${comments[1][1]}</body></html>`;
  const after = before.replace("Page", "Changed");
  const { context, view } = markerView(before, after, emptyUsage());
  const result = await compareComponentView(context, view, view);
  assert.equal(result.view.state, "changed");
  assert.equal(result.view.material, true);
  assert.deepEqual(result.view.ignoredIds, []);
  const pair = componentCssDocuments(before, after, "plain");
  assert.match(serialize(pair.before!), /<p>Page<\/p>/);
  assert.match(serialize(pair.after!), /<p>Changed<\/p>/);
});

test("former material comments remain material when their ordinary bytes change", async () => {
  const before = `<html><body>${comments[2][1]}</body></html>`;
  const after = before.replace("a".repeat(64), "b".repeat(64));
  const { context, view } = markerView(before, after, emptyUsage());
  const result = await compareComponentView(context, view, view);
  assert.equal(result.view.state, "changed");
  assert.equal(result.view.material, true);
  assert.deepEqual(result.view.ignoredIds, []);
});

for (const useFastPath of [false, true])
  test(`former comments cannot prove recorded baseline ranges, fast=${useFastPath}`, async () => {
    const before = `<html><body>${comments[0][1]}</body></html>`;
    const after = before.replaceAll("mokabook-component:", "mokly-component:");
    const usage = {
      ...emptyUsage(),
      ranges: [{ id: "r-0", target: { kind: "root" as const } }],
    };
    const { context, view } = markerView(before, after, usage);
    await assert.rejects(
      compareComponentView({ ...context, useFastPath }, view, view, "action"),
      (error) =>
        error instanceof ComponentValidationError &&
        error.detail === "missing component boundaries",
    );
    assert.throws(
      () =>
        componentCssDocuments(before, after, "plain", usage, usage, "action"),
      (error) =>
        error instanceof ComponentValidationError &&
        error.detail === "missing component boundaries",
    );
  });
