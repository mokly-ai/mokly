import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { CatalogueNavigation } from "../src/catalogue-navigation/catalogue-navigation.js";

import { column, leaf, link, specs } from "./navigation-fixture.js";

/** An address for every filter but the shown one, like a static artboard. */
function others(shown: "all" | "changes") {
  return (view: "all" | "changes") =>
    view === shown ? undefined : `../${view}/index.html`;
}

test("a filter with an address is a link, and the shown filter's link is the current page", () => {
  const calls: unknown[][] = [];
  render(
    <CatalogueNavigation
      {...column({
        filter: { count: 2, status: "ready", view: "changes" },
        filterHref: (view) => `#${view}`,
        onView: (view) => calls.push(["view", view]),
      })}
    />,
  );
  const filter = screen.getByRole("group", { name: "Catalogue filter" });
  assert.deepEqual(
    within(filter)
      .getAllByRole("link")
      .map((option) => [
        option.textContent,
        option.getAttribute("href"),
        option.getAttribute("aria-current"),
        option.getAttribute("data-filter"),
        option.className,
      ]),
    [
      ["All", "#all", null, "all", "mbk-nav-filter-opt"],
      ["Changes2", "#changes", "page", "changed", "mbk-nav-filter-opt active"],
    ],
  );
  assert.deepEqual(within(filter).queryAllByRole("button"), []);
  fireEvent.click(within(filter).getByRole("link", { name: "All" }));
  assert.deepEqual(calls, []);
});

test("a filter without an address stays a button beside a link", () => {
  const calls: unknown[][] = [];
  render(
    <CatalogueNavigation
      {...column({
        filter: { count: 2, status: "ready", view: "all" },
        filterHref: others("all"),
        onView: (view) => calls.push(["view", view]),
      })}
    />,
  );
  const filter = screen.getByRole("group", { name: "Catalogue filter" });
  const all = within(filter).getByRole("button", { name: "All" });
  assert.equal(all.getAttribute("aria-pressed"), "true");
  const changes = within(filter).getByRole("link", { name: /^Changes/u });
  assert.equal(changes.getAttribute("href"), "../changes/index.html");
  fireEvent.click(all);
  assert.deepEqual(calls, [["view", "all"]]);
});

test("a column that is not operable draws Collapse all, the shown filter, and the separator as pictures", () => {
  const calls: unknown[][] = [];
  const { container } = render(
    <CatalogueNavigation
      {...column({
        filter: { status: "pending", view: "changes" },
        filterHref: others("changes"),
        onCollapseAll: () => calls.push(["collapse"]),
        onWidth: (width) => calls.push(["width", width]),
        operable: false,
      })}
    />,
  );
  const nav = screen.getByRole("navigation", { name: "Catalogue" });
  // No control of the column acts without a script.
  assert.deepEqual(within(nav).queryAllByRole("button"), []);
  assert.equal(within(nav).queryByRole("separator"), null);
  const collapse = nav.querySelector(".mbk-nav-collapse");
  assert.equal(collapse?.tagName, "SPAN");
  assert.equal(collapse?.textContent, "Collapse all");
  assert.equal(collapse?.getAttribute("data-mokly-collapse"), "");

  const filter = within(nav).getByRole("group", { name: "Catalogue filter" });
  const all = within(filter).getByRole("link", { name: "All" });
  assert.equal(all.getAttribute("href"), "../all/index.html");
  const changes = filter.querySelector('[data-filter="changed"]');
  assert.equal(changes?.tagName, "SPAN");
  assert.equal(changes?.getAttribute("aria-current"), "page");
  assert.equal(changes?.className, "mbk-nav-filter-opt active");
  // The count slot keeps the spinner that names the detection at work.
  assert.ok(
    within(filter).getByRole("status", { name: "Checking for changes" }),
  );

  const grip = container.querySelector("[data-mokly-nav-resize]");
  assert.ok(grip);
  assert.equal(grip.className, "mbk-nav-resize");
  assert.equal(grip.getAttribute("aria-hidden"), "true");
  assert.equal(grip.getAttribute("tabindex"), null);
  assert.equal(grip.getAttribute("role"), null);
  fireEvent.keyDown(grip, { key: "ArrowRight" });
  fireEvent.doubleClick(grip);
  if (collapse) fireEvent.click(collapse);
  assert.deepEqual(calls, []);
});

test("a filter without an address in a column that is not operable is text", () => {
  render(
    <CatalogueNavigation
      {...column({
        filter: { count: 1, status: "ready", view: "all" },
        operable: false,
      })}
    />,
  );
  const filter = screen.getByRole("group", { name: "Catalogue filter" });
  assert.deepEqual(within(filter).queryAllByRole("link"), []);
  assert.deepEqual(
    [...filter.children].map((option) => [
      option.tagName,
      option.getAttribute("aria-current"),
      option.className,
    ]),
    [
      ["SPAN", "page", "mbk-nav-filter-opt active"],
      ["SPAN", null, "mbk-nav-filter-opt"],
    ],
  );
});

test("a row without an address is a picture of the row with every row mark", () => {
  const marks = { changed: true, current: true, label: "Save failed" };
  const { container } = render(
    <CatalogueNavigation
      {...column({
        operable: false,
        sections: [
          specs([
            leaf(link("linked", marks)),
            leaf(link("pictured", { ...marks, href: undefined })),
          ]),
        ],
      })}
    />,
  );
  const [row, picture] = container.querySelectorAll("[data-nav-row]");
  assert.ok(row && picture);
  assert.equal(row.tagName, "A");
  assert.equal(picture.tagName, "SPAN");
  assert.equal(picture.getAttribute("href"), null);
  for (const name of [
    "aria-current",
    "class",
    "data-changed",
    "data-entry-kind",
    "style",
  ])
    assert.equal(picture.getAttribute(name), row.getAttribute(name), name);
  assert.equal(picture.getAttribute("aria-current"), "page");
  // The picture holds exactly what the link holds, the changed wording too.
  assert.equal(picture.innerHTML, row.innerHTML);
  assert.equal(within(container).queryByRole("link", { name: /Save/u }), row);
});
