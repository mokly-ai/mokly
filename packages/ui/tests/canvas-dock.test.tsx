import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";

import { CanvasDock } from "../src/canvas-dock/canvas-dock.js";

import { assertSameElement } from "./dom-assertions.js";

/** The names of the dock's controls, in order. */
function names(group: HTMLElement): (string | null)[] {
  return within(group)
    .getAllByRole("button")
    .map((button) => button.textContent || button.getAttribute("aria-label"));
}

test("the dock is a group named Canvas controls with Catalogue, the current tab and Fit", () => {
  const pressed: string[] = [];
  render(
    <CanvasDock
      onCatalogue={() => pressed.push("catalogue")}
      onFit={() => pressed.push("fit")}
      onTab={() => pressed.push("tab")}
      tab="inspect"
    />,
  );
  const group = screen.getByRole("group", { name: "Canvas controls" });
  assert.deepEqual(names(group), ["Catalogue", "Inspect", "Fit"]);
  for (const name of ["Catalogue", "Inspect", "Fit"])
    fireEvent.click(within(group).getByRole("button", { name }));
  assert.deepEqual(pressed, ["catalogue", "tab", "fit"]);
});

test("with nothing selected the dock holds Catalogue alone, and Fit shows only with its callback", () => {
  const { rerender } = render(<CanvasDock onCatalogue={() => undefined} />);
  const group = screen.getByRole("group", { name: "Canvas controls" });
  assert.deepEqual(names(group), ["Catalogue"]);
  rerender(<CanvasDock onCatalogue={() => undefined} tab="inspect" />);
  assert.deepEqual(names(group), ["Catalogue", "Inspect"]);
  rerender(<CanvasDock onCatalogue={() => undefined} tab="changes" />);
  assert.deepEqual(names(group), ["Catalogue", "Changes"]);
});

test("the host receives Catalogue and the tab, which it focuses when a sheet closes", () => {
  const catalogue = createRef<HTMLButtonElement>();
  const tab = createRef<HTMLButtonElement>();
  render(
    <CanvasDock
      catalogueRef={catalogue}
      onCatalogue={() => undefined}
      tab="inspect"
      tabRef={tab}
    />,
  );
  assertSameElement(
    catalogue.current,
    screen.getByRole("button", { name: "Catalogue" }),
  );
  assertSameElement(
    tab.current,
    screen.getByRole("button", { name: "Inspect" }),
  );
});
