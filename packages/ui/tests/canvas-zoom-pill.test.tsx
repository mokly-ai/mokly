import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { CanvasZoomPill } from "../src/canvas-zoom-pill/canvas-zoom-pill.js";

test("the zoom pill is a group named Zoom with Zoom out, the whole percentage, Zoom in and Fit", () => {
  const pressed: string[] = [];
  render(
    <CanvasZoomPill
      onFit={() => pressed.push("fit")}
      onZoomIn={() => pressed.push("in")}
      onZoomOut={() => pressed.push("out")}
      zoom={0.3796}
    />,
  );
  const group = screen.getByRole("group", { name: "Zoom" });
  assert.deepEqual(
    within(group)
      .getAllByRole("button")
      .map((button) => button.textContent || button.getAttribute("aria-label")),
    ["Zoom out", "Zoom in", "Fit"],
  );
  assert.equal(group.textContent, "38%Fit");
  fireEvent.click(within(group).getByRole("button", { name: "Zoom out" }));
  fireEvent.click(within(group).getByRole("button", { name: "Zoom in" }));
  fireEvent.click(within(group).getByRole("button", { name: "Fit" }));
  assert.deepEqual(pressed, ["out", "in", "fit"]);
});

test("the pill rounds the zoom to a whole percentage", () => {
  const { rerender } = render(
    <CanvasZoomPill
      onFit={() => {}}
      onZoomIn={() => {}}
      onZoomOut={() => {}}
      zoom={1}
    />,
  );
  const value = () =>
    screen.getByRole("group", { name: "Zoom" }).querySelector(".mbk-zoom-value")
      ?.textContent;
  assert.equal(value(), "100%");
  rerender(
    <CanvasZoomPill
      onFit={() => {}}
      onZoomIn={() => {}}
      onZoomOut={() => {}}
      zoom={0.08}
    />,
  );
  assert.equal(value(), "8%");
  rerender(
    <CanvasZoomPill
      onFit={() => {}}
      onZoomIn={() => {}}
      onZoomOut={() => {}}
      zoom={1.256}
    />,
  );
  assert.equal(value(), "126%");
});
