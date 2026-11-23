import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { CanvasDock } from "../src/canvas-dock/canvas-dock.js";

import { assertSameList } from "./dom-assertions.js";

test("a static dock draws Catalogue, the current tab and Fit as pictures that act on nothing", () => {
  const pressed: string[] = [];
  render(
    <CanvasDock
      interactive={false}
      onCatalogue={() => pressed.push("catalogue")}
      onFit={() => pressed.push("fit")}
      onTab={() => pressed.push("tab")}
      tab="changes"
    />,
  );
  const group = screen.getByRole("group", { name: "Canvas controls" });
  assertSameList(within(group).queryAllByRole("button"), []);
  const pictures = within(group).getAllByRole("img");
  assert.deepEqual(
    pictures.map((picture) => [
      picture.tagName,
      picture.getAttribute("aria-label"),
      picture.getAttribute("title"),
      picture.getAttribute("data-dock-control"),
    ]),
    [
      ["SPAN", "Catalogue", "Catalogue", "catalogue"],
      ["SPAN", "Changes", "Changes", "changes"],
      ["SPAN", "Fit", "Fit", "fit"],
    ],
  );
  for (const picture of pictures) fireEvent.click(picture);
  assert.deepEqual(pressed, []);
});
