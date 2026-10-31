import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import {
  ComparisonFailure,
  ComparisonPanes,
  ComparisonSection,
  ComparisonStage,
  ComparisonUnavailable,
} from "../src/comparison-stage/comparison-stage.js";

test("Current shows the preview and hides the stage, after the band", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComparisonStage current entryId="screens/a" toolbar={<i>band</i>}>
        <i>current</i>
      </ComparisonStage>,
    ),
    '<section class="mbk-diff-screen" data-diff-screen="screens/a"><i>band</i><div class="mbk-current-screen" data-current-screen=""><i>current</i></div><div aria-live="polite" class="mbk-diff-stage" data-diff-stage="" hidden="">Loading comparison…</div></section>',
  );
});

test("a comparison mode shows the stage, which loads until it has content", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComparisonStage busy component current={false} entryId="c/v">
        <i>current</i>
      </ComparisonStage>,
    ),
    '<section class="mbk-diff-screen" data-diff-component="" data-diff-screen="c/v"><div class="mbk-current-screen" data-current-screen="" hidden=""><i>current</i></div><div aria-busy="true" aria-live="polite" class="mbk-diff-stage" data-diff-stage="">Loading comparison…</div></section>',
  );
  const { container } = render(
    <ComparisonStage current={false} entryId="a" stage={<i>sections</i>} />,
  );
  const stage = container.querySelector("[data-diff-stage]");
  assert.ok(stage instanceof HTMLElement);
  assert.equal(stage.hidden, false);
  assert.equal(stage.textContent, "sections");
});

test("a section's heading names the viewport, the state, and a Light-only view", () => {
  // renderToString keeps the heading's text nodes apart, as the shell
  // renders them.
  assert.equal(
    renderToString(
      <ComparisonSection label="Screen changed" lightOnly viewport="mobile">
        <i>panes</i>
      </ComparisonSection>,
    ),
    '<section class="mbk-diff-view mbk-diff-mobile" data-diff-viewport="mobile"><h3>Mobile<!-- --> · <!-- -->Screen changed<!-- --> · Light only</h3><i>panes</i></section>',
  );
  render(<ComparisonSection label="New screen" viewport="desktop" />);
  assert.equal(
    screen.getByRole("heading", { level: 3 }).textContent,
    "Desktop · New screen",
  );
});

test("the panes' grid records the comparison mode", () => {
  for (const mode of ["side", "overlay", "difference"] as const)
    assert.equal(
      renderToStaticMarkup(<ComparisonPanes mode={mode} />),
      `<div class="mb-panes" data-compare-mode="${mode}"></div>`,
    );
  assert.equal(
    renderToStaticMarkup(
      <ComparisonUnavailable message="This variant has no comparison available." />,
    ),
    "<p>This variant has no comparison available.</p>",
  );
});

test("a comparison that could not load offers Try again", () => {
  assert.match(
    renderToStaticMarkup(
      <ComparisonFailure details="offline" onRetry={() => undefined} />,
    ),
    /^<p>The comparison could not be loaded\. <button class="mbk-empty-link" data-diff-refresh="" type="button">Try again<\/button><\/p>/,
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
