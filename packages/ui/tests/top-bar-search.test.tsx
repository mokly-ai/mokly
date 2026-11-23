import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";

import { TopBar, type TopBarHandle } from "../src/top-bar/top-bar.js";

import { assertNotSameElement, assertSameElement } from "./dom-assertions.js";

const IDS = { navigationId: "root-mb-nav", searchId: "root-mb-search" };

function searchField(): HTMLInputElement {
  const field = screen.getByRole("searchbox", { name: "Search catalogue" });
  assert.ok(field instanceof HTMLInputElement);
  return field;
}

function searchToggle(): HTMLElement {
  return screen.getByRole("button", { name: "Search catalogue" });
}

test("the handle moves focus to the shown search field and leaves the compact search closed", () => {
  const bar = createRef<TopBarHandle>();
  const { container } = render(
    <TopBar {...IDS} drawerOpen={false} ref={bar} />,
  );
  assertNotSameElement(document.activeElement, searchField());
  act(() => bar.current?.focusSearch());
  assertSameElement(document.activeElement, searchField());
  assert.equal(
    container.querySelector("header")?.getAttribute("data-compact-search"),
    "closed",
  );
  assert.equal(searchToggle().getAttribute("aria-expanded"), "false");
});

test("the handle opens the compact search where the field takes no focus", () => {
  const bar = createRef<TopBarHandle>();
  const { container } = render(
    <TopBar {...IDS} drawerOpen={false} ref={bar} />,
  );
  const header = container.querySelector("header");
  assert.ok(header);
  // The compact bar hides the field. An inert field also takes no focus.
  const field = searchField().parentElement;
  assert.ok(field);
  field.inert = true;
  act(() => bar.current?.focusSearch());
  assert.equal(header.getAttribute("data-compact-search"), "open");
  assert.equal(searchToggle().getAttribute("aria-expanded"), "true");
  // Once the compact search shows its field, the field takes focus.
  field.inert = false;
  act(() => bar.current?.focusSearch());
  assertSameElement(document.activeElement, searchField());
  assert.equal(header.getAttribute("data-compact-search"), "open");
});

test("the field of an interactive bar names the search keys, and a static bar's field names none", () => {
  const { rerender } = render(<TopBar {...IDS} drawerOpen={false} />);
  assert.equal(
    searchField().getAttribute("aria-keyshortcuts"),
    "Control+K Meta+K /",
  );
  rerender(<TopBar {...IDS} drawerOpen={false} interactive={false} />);
  assert.equal(searchField().getAttribute("aria-keyshortcuts"), null);
});
