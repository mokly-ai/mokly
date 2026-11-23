import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import {
  PreviewNotCaptured,
  StageFailure,
  StageLoading,
} from "../src/preview-state/preview-state.js";

test("the routed stage waits for the entry's details with a quiet status", () => {
  assert.equal(
    renderToStaticMarkup(<StageLoading />),
    '<div aria-busy="true" class="mbk-empty mbk-reset" data-mokly-stage="" data-viewport="both"><p class="mbk-reset" role="status">Loading preview…</p></div>',
  );
  render(<StageLoading />);
  assert.equal(screen.getByRole("status").textContent, "Loading preview…");
});

test("a failed detail names the entry and offers one retry", () => {
  let retries = 0;
  assert.equal(
    renderToStaticMarkup(<StageFailure noun="user flow" />),
    '<div class="mbk-empty mbk-reset" role="alert"><h2 class="mbk-reset">This user flow could not be shown</h2><p class="mbk-reset">The catalogue is still available while you try again.</p><button class="mbk-empty-link mbk-reset" type="button">Try again</button></div>',
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

test("a viewport without a captured version names the other viewport", () => {
  assert.equal(
    renderToString(<PreviewNotCaptured viewport="mobile" />),
    '<div class="mbk-preview-state mbk-reset"><p class="mbk-preview-note mbk-reset" role="status">No previous <!-- -->mobile<!-- --> version was captured.<!-- --> <span class="mbk-preview-switch mbk-reset">Switch to <!-- -->Desktop<!-- --> to see it.</span></p></div>',
  );
  render(<PreviewNotCaptured viewport="desktop" />);
  assert.equal(
    screen.getByRole("status").textContent,
    "No previous desktop version was captured. Switch to Mobile to see it.",
  );
});
