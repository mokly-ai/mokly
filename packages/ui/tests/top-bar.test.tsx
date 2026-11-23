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
  assert.equal(bar.className, "mbk-topbar mbk-reset");
  assert.equal(bar.getAttribute("data-compact-search"), "closed");
  assert.equal(bar.getAttribute("data-search"), "");

  const brand = screen.getByRole("link", { name: "Mokly" });
  assert.equal(brand.getAttribute("href"), "/");
  assert.equal(brand.textContent, "mokly.");

  assert.equal(searchToggle().getAttribute("aria-controls"), "root-mb-search");
  assert.equal(searchToggle().getAttribute("aria-expanded"), "false");
  const field = searchField();
  assert.equal(field.id, "root-mb-search");
  assert.equal(field.value, "hom");
  assert.equal(field.placeholder, "Search");
  assert.equal(field.getAttribute("data-mokly-search"), "");
  assert.ok(screen.getByRole("button", { name: "Close search" }));
});

test("the bar of the shell has no menu button, whatever drawer state it is given", () => {
  // The dock of the compact layout opens the catalogue's sheet, so the bar
  // draws no menu, and the menu's props of an earlier host change nothing.
  const drawers: boolean[] = [];
  for (const drawerOpen of [false, true]) {
    const { container, unmount } = render(
      <TopBar
        {...IDS}
        drawerOpen={drawerOpen}
        onDrawer={(open) => drawers.push(open)}
      />,
    );
    assert.equal(container.querySelector("[data-mokly-menu]"), null);
    assert.equal(
      screen.queryByRole("button", { name: /catalogue navigation/u }),
      null,
    );
    unmount();
  }
  assert.deepEqual(drawers, []);
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
  // The magnifier, the input, the key hint, then the tag picker.
  assert.deepEqual(
    [...search.children].map((child) => child.tagName.toLowerCase()),
    ["svg", "input", "kbd", "span"],
  );
  assert.ok(search.lastElementChild?.hasAttribute("data-picker"));
  const end =
    container.querySelector("header")?.lastElementChild?.lastElementChild;
  assert.ok(end);
  assert.ok(end.hasAttribute("data-end"));
  // The end control follows the search, whose parts end with Close search.
  assert.equal(
    end.previousElementSibling?.lastElementChild?.getAttribute("aria-label"),
    "Close search",
  );
});

/** Each column of the bar, as its parts in order: a package class or a mark. */
function columns(container: HTMLElement): string[][] {
  const bar = container.querySelector("header");
  assert.ok(bar);
  return [...bar.children].map((column) =>
    [...column.children].map(
      (part) => part.getAttribute("data-part") ?? part.classList[0] ?? "",
    ),
  );
}

test("the bar starts with the brand and ends with the search and the end control", () => {
  const { container } = render(
    <TopBar {...IDS} drawerOpen={false} end={<span data-part="end" />} />,
  );
  assert.deepEqual(columns(container), [
    ["mbk-brand"],
    ["mbk-search-group", "end"],
  ]);
  assert.deepEqual(
    [...container.querySelector("header")!.children].map(
      (column) => column.className,
    ),
    ["mbk-topbar-start mbk-reset", "mbk-topbar-end mbk-reset"],
  );
});

test("the host's slots follow the brand, fill the centre column, and follow the end control", () => {
  const { container } = render(
    <TopBar
      {...IDS}
      drawerOpen={false}
      end={<span data-part="end" />}
      host={{
        start: <div data-part="host start" />,
        center: <div data-part="host centre" />,
        end: <div data-part="host end" />,
      }}
    />,
  );
  assert.deepEqual(columns(container), [
    ["mbk-brand", "host start"],
    ["host centre"],
    ["mbk-search-group", "end", "host end"],
  ]);
  assert.deepEqual(
    [...container.querySelector("header")!.children].map(
      (column) => column.className,
    ),
    [
      "mbk-topbar-start mbk-reset",
      "mbk-topbar-center mbk-reset",
      "mbk-topbar-end mbk-reset",
    ],
  );
  // The host's start slot follows the brand, so the brand is the mark alone.
  const brand = screen.getByRole("link", { name: "Mokly" });
  assert.equal(brand.textContent, "");
  assert.equal(brand.querySelector(".mbk-name"), null);
  assert.ok(brand.querySelector(".mbk-mark svg"));
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
