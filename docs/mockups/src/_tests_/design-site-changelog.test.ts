import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertHoverChangesMoreThanColor,
  attribute,
  byClass,
  label,
  siteDocument,
  siteStyles,
} from "./design-site-test-helpers";

/** The changelog's controls, each of which promises a hover state. */
const hoverClasses = ["site-release-index-link", "site-release-link"];

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: changelog is an indexed release list`, () => {
    const { document } = siteDocument("design/site/changelog", viewport);
    assert.deepEqual(
      byClass(document, "site-release-index-version").map(label),
      [
        "0.18.0",
        "0.17.0",
        "0.16.1",
        "0.16.0",
        "0.15.0",
        "0.14.0",
        "0.13.0",
        "0.12.0",
        "0.11.0",
        "0.10.0",
        "0.9.0",
      ],
    );
    assert.deepEqual(
      byClass(document, "site-release-index-link").map((node) =>
        attribute(node, "href"),
      ),
      [
        "#release-0-18-0",
        "#release-0-17-0",
        "#release-0-16-1",
        "#release-0-16-0",
        "#release-0-15-0",
        "#release-0-14-0",
        "#release-0-13-0",
        "#release-0-12-0",
        "#release-0-11-0",
        "#release-0-10-0",
        "#release-0-9-0",
      ],
    );
    assert.deepEqual(byClass(document, "site-badge--neutral").map(label), [
      "Mokly CLI 0.18.0",
      "Mokly CLI 0.17.0",
      "Mokly CLI 0.16.1",
      "Mokly CLI 0.16.0",
      "Mokly CLI 0.15.0",
      "Mokly CLI 0.14.0",
      "Mokly CLI 0.13.0",
      "Mokly CLI 0.12.0",
      "Mokly CLI 0.11.0",
      "Mokly CLI 0.10.0",
      "Mokly CLI 0.9.0",
    ]);
  });
}

test("every promised changelog control changes more than color on hover", () => {
  assertHoverChangesMoreThanColor(hoverClasses);
});

test("split site styles own the changelog compositions", () => {
  assert.ok(siteStyles().includes(".site-release {"), ".site-release");
});
