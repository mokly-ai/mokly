import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasStage } from "../src/canvas-stage/canvas-stage.js";

import { SECTION } from "./canvas-stage-fixture.js";
import { assertSameList } from "./dom-assertions.js";

/** A view that a static mockup gives, off whole pixels as Fit's can be. */
const VIEW = { x: 41.8, y: 16.2, zoom: 0.3187 };

test("a canvas that runs no script draws its section at the view that it is given", () => {
  const markup = renderToStaticMarkup(
    <CanvasStage section={SECTION} view={VIEW} />,
  );
  // The section stands on whole pixels, and the dot grid moves with it.
  assert.match(
    markup,
    /<div class="mbk-canvas-world mbk-reset" style="--mbk-canvas-zoom:0.3187;transform:translate\(42px, 16px\)">/u,
  );
  assert.match(markup, /style="background-position:18px 16px"/u);
  assert.match(markup, /<span class="mbk-zoom-value mbk-reset">32%<\/span>/u);
  // Below 60% the canvas hides the fixed-size tags on its frames.
  assert.match(markup, /data-canvas-tags="hidden"/u);
});

test("a canvas that is not interactive draws its zoom pill's controls as pictures", () => {
  render(<CanvasStage interactive={false} section={SECTION} view={VIEW} />);
  const pill = screen.getByRole("group", { name: "Zoom" });
  assertSameList(within(pill).queryAllByRole("button"), []);
  assert.deepEqual(
    within(pill)
      .getAllByRole("img")
      .map((picture) => picture.getAttribute("aria-label")),
    ["Zoom out", "Zoom in", "Fit"],
  );
});
