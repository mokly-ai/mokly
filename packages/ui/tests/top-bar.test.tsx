import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { TopBar } from "../src/top-bar/top-bar.js";

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

test("the bar names its controls as the shell specs query them", () => {
  const { container } = render(
    <TopBar {...IDS} drawerOpen={false} query="hom" />,
  );
  const bar = container.querySelector("header");
  assert.ok(bar);
  assert.equal(bar.className, "mbk-topbar");
  assert.equal(bar.getAttribute("data-compact-search"), "closed");
  assert.equal(bar.getAttribute("data-search"), "");

  const menu = screen.getByRole("button", {
    name: "Open catalogue navigation",
  });
  assert.equal(menu.getAttribute("aria-controls"), "root-mb-nav");
  assert.equal(menu.getAttribute("aria-expanded"), "false");
  assert.equal(menu.getAttribute("data-mokly-menu"), "");

  const brand = screen.getByRole("link", { name: "Mokly" });
  assert.equal(brand.getAttribute("href"), "/");
  assert.equal(brand.textContent, "mokly.");

  assert.equal(searchToggle().getAttribute("aria-controls"), "root-mb-search");
  assert.equal(searchToggle().getAttribute("aria-expanded"), "false");
  const field = searchField();
  assert.equal(field.id, "root-mb-search");
  assert.equal(field.value, "hom");
  assert.equal(field.placeholder, "Search catalogue…");
  assert.equal(field.getAttribute("data-mokly-search"), "");
  assert.ok(screen.getByRole("button", { name: "Close search" }));
});

test("the menu reports the drawer state that it asks for", () => {
  const drawers: boolean[] = [];
  const { rerender } = render(
    <TopBar
      {...IDS}
      drawerOpen={false}
      onDrawer={(open) => drawers.push(open)}
    />,
  );
  const menu = screen.getByRole("button", {
    name: "Open catalogue navigation",
  });
  fireEvent.click(menu);
  rerender(
    <TopBar {...IDS} drawerOpen onDrawer={(open) => drawers.push(open)} />,
  );
  assert.equal(menu.getAttribute("aria-expanded"), "true");
  fireEvent.click(menu);
  assert.deepEqual(drawers, [true, false]);
});

test("each typed search text reaches the callback in order", () => {
  const queries: string[] = [];
  render(
    <TopBar
      {...IDS}
      drawerOpen={false}
      onSearch={(query) => queries.push(query)}
      query=""
    />,
  );
  fireEvent.change(searchField(), { target: { value: "ho" } });
  fireEvent.change(searchField(), { target: { value: "home" } });
  assert.deepEqual(queries, ["ho", "home"]);
});

test("without a query the field keeps its own text", () => {
  const markup = renderToStaticMarkup(<TopBar {...IDS} drawerOpen={false} />);
  assert.doesNotMatch(markup, /<input[^>]* value=/);
  render(<TopBar {...IDS} drawerOpen={false} />);
  fireEvent.change(searchField(), { target: { value: "card" } });
  assert.equal(searchField().value, "card");
});

test("the tag picker ends the search field and the end control ends the bar", () => {
  const { container } = render(
    <TopBar
      {...IDS}
      drawerOpen={false}
      end={<span data-end="" />}
      tagPicker={<span data-picker="" />}
    />,
  );
  const search = container.querySelector(".mbk-search");
  assert.ok(search);
  assert.deepEqual(
    [...search.children].map((child) => child.tagName.toLowerCase()),
    ["svg", "input", "span"],
  );
  assert.ok(search.lastElementChild?.hasAttribute("data-picker"));
  const end = container.querySelector("header")?.lastElementChild;
  assert.ok(end);
  assert.ok(end.hasAttribute("data-end"));
  assert.equal(
    end.previousElementSibling?.getAttribute("aria-label"),
    "Close search",
  );
});

test("the compact search focuses its field and returns focus to its toggle", () => {
  const { container } = render(<TopBar {...IDS} drawerOpen={false} />);
  const bar = container.querySelector("header");
  assert.ok(bar);
  // Before the compact search ever opened, focus stays where it is.
  assertNotSameElement(document.activeElement, searchToggle());

  fireEvent.click(searchToggle());
  assert.equal(bar.getAttribute("data-compact-search"), "open");
  assert.equal(searchToggle().getAttribute("aria-expanded"), "true");
  assertSameElement(document.activeElement, searchField());

  // A key other than Escape keeps it open.
  fireEvent.keyDown(searchField(), { key: "Enter" });
  assert.equal(bar.getAttribute("data-compact-search"), "open");
  fireEvent.keyDown(searchField(), { key: "Escape" });
  assert.equal(bar.getAttribute("data-compact-search"), "closed");
  assert.equal(searchToggle().getAttribute("aria-expanded"), "false");
  assertSameElement(document.activeElement, searchToggle());

  fireEvent.click(searchToggle());
  assertSameElement(document.activeElement, searchField());
  fireEvent.click(screen.getByRole("button", { name: "Close search" }));
  assert.equal(bar.getAttribute("data-compact-search"), "closed");
  assertSameElement(document.activeElement, searchToggle());
});
