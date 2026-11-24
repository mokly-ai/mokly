import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ComparisonFailure,
  ComparisonPanes,
} from "../src/comparison-stage/comparison-stage.js";

test("the panes' grid records the comparison mode", () => {
  for (const mode of ["side", "overlay", "difference"] as const)
    assert.equal(
      renderToStaticMarkup(<ComparisonPanes mode={mode} />),
      `<div class="mb-panes mbk-reset" data-compare-mode="${mode}"></div>`,
    );
});

test("a comparison that could not load offers Try again", () => {
  assert.match(
    renderToStaticMarkup(
      <ComparisonFailure details="offline" onRetry={() => undefined} />,
    ),
    /^<p class="mbk-reset">The comparison could not be loaded\. <button class="mbk-empty-link mbk-reset" data-diff-refresh="" type="button">Try again<\/button><\/p>/,
  );
});

test("Try again reports each press, and the details hold what failed", () => {
  let retries = 0;
  render(<ComparisonFailure details="offline" onRetry={() => retries++} />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  assert.equal(retries, 1);
  const summary = screen.getByText("Comparison details", { exact: true });
  assert.equal(summary.tagName, "SUMMARY");
  const details = summary.parentElement;
  assert.ok(details instanceof HTMLDetailsElement);
  assert.equal(details.getAttribute("data-comparison-failure"), "");
  assert.equal(details.open, false);
  assert.ok(screen.getByText("offline").parentElement === details);
});
