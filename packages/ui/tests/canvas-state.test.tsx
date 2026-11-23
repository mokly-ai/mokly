import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";

import { CanvasPreviousVersion } from "../src/canvas-previous-version/canvas-previous-version.js";
import { CanvasState } from "../src/canvas-state/canvas-state.js";
import { EmptyState } from "../src/empty-state/empty-state.js";

import { assertSameElement } from "./dom-assertions.js";

test("a canvas that holds a state in place of a section shows the state on its grid, with no zoom pill", () => {
  const { container } = render(
    <CanvasPreviousVersion descriptor="">
      <CanvasState routed>
        <EmptyState body="Loading previous version…" busy />
      </CanvasState>
    </CanvasPreviousVersion>,
  );
  // The host carries the preview request and announces each state of it.
  const host = container.querySelector("[data-mokly-preview]");
  assert.equal(host?.getAttribute("aria-live"), "polite");
  // The routed canvas holds the state, and no section and no zoom pill.
  assert.equal(host?.querySelectorAll("[data-mokly-stage]").length, 1);
  assertSameElement(container.querySelector("section"), null);
  assertSameElement(screen.queryByRole("group", { name: "Zoom" }), null);
  assert.equal(
    screen.getByRole("status").textContent,
    "Loading previous version…",
  );
});
