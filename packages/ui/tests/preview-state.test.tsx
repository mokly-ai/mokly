import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import {
  PreviewLoading,
  PreviewNotCaptured,
  PreviewUnavailable,
  StageFailure,
  StageLoading,
} from "../src/preview-state/preview-state.js";

test("the routed stage waits for the entry's details with a quiet status", () => {
  assert.equal(
    renderToStaticMarkup(<StageLoading />),
    '<div aria-busy="true" class="mbk-empty" data-mokly-stage="" data-viewport="both"><p role="status">Loading preview…</p></div>',
  );
  render(<StageLoading />);
  assert.equal(screen.getByRole("status").textContent, "Loading preview…");
});

test("a failed detail names the entry and offers one retry", () => {
  let retries = 0;
  assert.equal(
    renderToStaticMarkup(<StageFailure noun="user flow" />),
    '<div class="mbk-empty" role="alert"><h2>This user flow could not be shown</h2><p>The catalogue is still available while you try again.</p><button class="mbk-empty-link" type="button">Try again</button></div>',
  );
  render(<StageFailure noun="screen" onRetry={() => retries++} />);
  assert.ok(screen.getByRole("alert"));
  assert.ok(
    screen.getByRole("heading", { name: "This screen could not be shown" }),
  );
  assert.equal(screen.getAllByRole("button").length, 1);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  assert.equal(retries, 1);
});

test("a previous version loads with a spinner and a status", () => {
  assert.equal(
    renderToStaticMarkup(<PreviewLoading />),
    '<div class="mbk-stage"><div class="mbk-preview-state"><p class="mbk-preview-status" role="status"><span aria-hidden="true" class="mbk-preview-spinner"></span>Loading previous version…</p></div></div>',
  );
});

test("an unavailable previous version offers Retry only after a failed request", () => {
  const unavailable = {
    body: "The previous version could not be loaded.",
    title: "Previous version unavailable",
  };
  assert.equal(
    renderToStaticMarkup(<PreviewUnavailable {...unavailable} />),
    '<div class="mbk-stage"><div class="mbk-empty"><h2>Previous version unavailable</h2><p>The previous version could not be loaded.</p></div></div>',
  );
  let retries = 0;
  render(
    <PreviewUnavailable
      {...unavailable}
      retry={{
        label: "Retry",
        mark: "data-mokly-preview-retry",
        onClick: () => retries++,
      }}
    />,
  );
  assert.ok(
    screen.getByRole("heading", { name: "Previous version unavailable" }),
  );
  const retry = screen.getByRole("button", { name: "Retry" });
  assert.equal(retry.getAttribute("data-mokly-preview-retry"), "");
  fireEvent.click(retry);
  assert.equal(retries, 1);
});

test("a viewport without a captured version names the other viewport", () => {
  assert.equal(
    renderToString(<PreviewNotCaptured viewport="mobile" />),
    '<div class="mbk-preview-state"><p class="mbk-preview-note" role="status">No previous <!-- -->mobile<!-- --> version was captured.<!-- --> <span class="mbk-preview-switch">Switch to <!-- -->Desktop<!-- --> to see it.</span></p></div>',
  );
  render(<PreviewNotCaptured viewport="desktop" />);
  assert.equal(
    screen.getByRole("status").textContent,
    "No previous desktop version was captured. Switch to Mobile to see it.",
  );
});
