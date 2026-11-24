import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, within } from "@testing-library/react";

import {
  EmbeddedLayout,
  MarkerLayer,
} from "../src/embedded-layout/embedded-layout.js";
import type { FloatingPanelSheet } from "../src/floating-panel/floating-panel.js";
import { MainRegion, ShellLayout } from "../src/shell-layout/shell-layout.js";

import { assertSameList } from "./dom-assertions.js";

/** The catalogue's open sheet, at its compact height. */
const sheet: FloatingPanelSheet = {
  expanded: false,
  onClose: () => undefined,
  onExpandedChange: () => undefined,
  open: true,
};

/**
 * The controls of the floating catalogue in a rendered root: its buttons, and
 * the tag and the name of each picture.
 */
function catalogueControls(container: HTMLElement) {
  const panel = container.querySelector<HTMLElement>(
    '[data-floating-panel="left"]',
  );
  assert.ok(panel, "the catalogue floats in its panel");
  return {
    buttons: within(panel).queryAllByRole("button"),
    pictures: within(panel)
      .queryAllByRole("img")
      .map((picture) => [picture.tagName, picture.getAttribute("aria-label")]),
  };
}

/** The sheet's grabber and close control, each drawn as a picture. */
const pictures = [
  ["SPAN", "Expand catalogue"],
  ["SPAN", "Close catalogue"],
];

test("a static shell root draws the floating catalogue's sheet controls as pictures", () => {
  const { container } = render(
    <ShellLayout
      announcement=""
      catalogueSheet={sheet}
      colorScheme="light"
      drawerOpen={false}
      interactive={false}
      main={<MainRegion id="mb-main">Routed view</MainRegion>}
      mainHref="#mb-main"
      navigation={<nav aria-label="Catalogue" />}
      statusId="mb-status"
      theme="light"
      topBar={<header>Top bar</header>}
    />,
  );
  const controls = catalogueControls(container);
  assertSameList(controls.buttons, []);
  assert.deepEqual(controls.pictures, pictures);
});

test("a static embedded root draws the floating catalogue's sheet controls as pictures", () => {
  const { container } = render(
    <EmbeddedLayout
      announcement=""
      catalogueSheet={sheet}
      colorScheme="light"
      drawerOpen={false}
      emptyStateShown={false}
      interactive={false}
      main={<MainRegion id="x-mb-main">Routed view</MainRegion>}
      mainHref="#x-mb-main"
      markerLayer={<MarkerLayer markers={[]} />}
      navigation={<nav aria-label="Catalogue" />}
      statusId="x-mb-status"
      theme="light"
      topBar={() => <header>Top bar</header>}
    />,
  );
  const controls = catalogueControls(container);
  assertSameList(controls.buttons, []);
  assert.deepEqual(controls.pictures, pictures);
});
