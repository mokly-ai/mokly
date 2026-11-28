import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasFrame } from "../src/canvas-frame/canvas-frame.js";
import type { FrameRetry } from "../src/preview-frame/preview-frame.js";

const UNAVAILABLE =
  '<p class="mbk-empty mbk-reset">This preview is unavailable.</p>';
const ERROR =
  '<p class="mbk-frame-error mbk-reset" role="status">This preview could not be loaded.</p>';

/** A frame whose document failed to load, with that document if it has one. */
function failedFrame(document?: ReactNode, retry?: FrameRetry) {
  return (
    <CanvasFrame
      error
      height={844}
      kind="mobile"
      label="Mobile · Light"
      retry={retry}
      scheme="light"
      width={390}
    >
      {document}
    </CanvasFrame>
  );
}

/** The content of the note that stands in a frame's place. */
function note(markup: string): string | undefined {
  return /<div class="mbk-canvas-frame-note mbk-reset">(.*?)<\/div>/u.exec(
    markup,
  )?.[1];
}

test("a frame without content is unavailable, and a failed load adds its status", () => {
  assert.equal(
    note(renderToStaticMarkup(failedFrame())),
    `${UNAVAILABLE}${ERROR}`,
  );
  render(failedFrame(<i>frame</i>));
  assert.equal(
    screen.getByRole("status").textContent,
    "This preview could not be loaded.",
  );
  assert.equal(screen.queryAllByText("This preview is unavailable.").length, 0);
});

test("a failed load of a static depiction offers Try again as a link", () => {
  assert.equal(
    note(renderToStaticMarkup(failedFrame(<i />, { href: "../loading/" }))),
    '<p class="mbk-frame-error mbk-reset" role="status">This preview could not be loaded. <a class="mbk-empty-link mbk-reset" href="../loading/">Try again</a></p>',
  );
});

test("a frame that an earlier Mokly built names the way on, without Try again", () => {
  render(
    <CanvasFrame
      error={false}
      height={844}
      kind="mobile"
      label="Mobile · Light"
      outdated
      retry={{ onClick: () => undefined }}
      scheme="light"
      width={390}
    >
      <i>frame</i>
    </CanvasFrame>,
  );
  assert.equal(
    screen.getByRole("status").textContent,
    "This preview was built with an older version of Mokly. Update Mokly in the project, then publish it again.",
  );
  assert.equal(screen.queryAllByRole("button").length, 0);
});
