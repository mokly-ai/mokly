import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CatalogueNavigation,
  type NavigationStatusMessage,
} from "../src/catalogue-navigation/catalogue-navigation.js";

import { assertSameElement } from "./dom-assertions.js";
import { column, leaf, link, specs } from "./navigation-fixture.js";

function scrollPane(container: HTMLElement): HTMLElement {
  const pane = container.querySelector<HTMLElement>("[data-mokly-nav-scroll]");
  assert.ok(pane);
  return pane;
}

test("the column names its parts as the shell specs query them", () => {
  const { container } = render(<CatalogueNavigation {...column()} />);
  const nav = screen.getByRole("navigation", { name: "Catalogue" });
  assert.equal(nav.id, "root-mb-nav");
  assert.equal(nav.getAttribute("data-mokly-nav"), "");
  const head = nav.querySelector(".mbk-nav-head");
  assert.equal(head?.firstChild?.textContent, "Catalogue");
  const collapse = within(nav).getByRole("button", { name: "Collapse all" });
  assert.equal(collapse.getAttribute("data-mokly-collapse"), "");
  assert.equal(scrollPane(container).getAttribute("aria-busy"), "false");
  assert.ok(
    within(nav).getByRole("separator", { name: "Resize navigation panel" }),
  );
  // A catalogue without Changes shows no filter and no status line.
  assertSameElement(screen.queryByRole("group"), null);
  assertSameElement(screen.queryByRole("status"), null);
});

test("a resizable column carries its width, and a fixed one keeps the stylesheet's", () => {
  assert.match(
    renderToStaticMarkup(<CatalogueNavigation {...column({ width: 300 })} />),
    /^<nav aria-label="Catalogue" class="mbk-nav mbk-reset" data-mokly-nav="" data-resize-ready="" id="root-mb-nav" style="--mbk-nav-width:300px">/,
  );
  assert.match(
    renderToStaticMarkup(
      <CatalogueNavigation {...column({ resizable: false, width: 300 })} />,
    ),
    /^<nav aria-label="Catalogue" class="mbk-nav mbk-reset" data-mokly-nav="" id="root-mb-nav">/,
  );
});

test("Collapse all, the filter, and the tree's scroll report through their callbacks", () => {
  const calls: unknown[][] = [];
  const { container } = render(
    <CatalogueNavigation
      {...column({
        filter: { count: 2, status: "ready", view: "all" },
        onCollapseAll: () => calls.push(["collapse"]),
        onScroll: (top) => calls.push(["scroll", top]),
        onView: (view) => calls.push(["view", view]),
      })}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
  const filter = screen.getByRole("group", { name: "Catalogue filter" });
  fireEvent.click(within(filter).getByRole("button", { name: /^Changes/ }));
  fireEvent.click(within(filter).getByRole("button", { name: "All" }));
  const pane = scrollPane(container);
  pane.scrollTop = 40;
  fireEvent.scroll(pane);
  assert.deepEqual(calls, [
    ["collapse"],
    ["view", "changes"],
    ["view", "all"],
    ["scroll", 40],
  ]);
});

test("the filter presses its view and fills the count slot for each detection state", () => {
  const { rerender } = render(
    <CatalogueNavigation
      {...column({ filter: { count: 0, status: "ready", view: "changes" } })}
    />,
  );
  const filter = screen.getByRole("group", { name: "Catalogue filter" });
  assert.equal(filter.getAttribute("data-mokly-filter"), "");
  assert.equal(filter.getAttribute("data-changes-status"), "ready");
  const [all, changes] = within(filter).getAllByRole("button");
  assert.ok(all && changes);
  assert.deepEqual(
    [all, changes].map((button) => [
      button.getAttribute("data-filter"),
      button.getAttribute("aria-pressed"),
    ]),
    [
      ["all", "false"],
      ["changed", "true"],
    ],
  );
  const count = () => changes.querySelector(".mbk-nav-filter-count");
  assert.equal(count()?.textContent, "0");

  rerender(
    <CatalogueNavigation
      {...column({ filter: { status: "unavailable", view: "all" } })}
    />,
  );
  assert.equal(all.getAttribute("aria-pressed"), "true");
  assert.equal(
    count()?.innerHTML,
    '<span aria-label="Changes unavailable" class="mbk-reset">—</span>',
  );

  for (const [status, name] of [
    ["pending", "Checking for changes"],
    ["preparing", "Preparing comparison"],
  ] as const) {
    rerender(
      <CatalogueNavigation {...column({ filter: { status, view: "all" } })} />,
    );
    assert.equal(filter.getAttribute("data-changes-status"), status);
    const spinner = within(filter).getByRole("status", { name });
    assert.equal(spinner.className, "mbk-nav-spinner mbk-reset");
    assertSameElement(spinner.parentElement, count());
  }
});

test("the status line words each detection state, and preparing has two lines", () => {
  const { container, rerender } = render(
    <CatalogueNavigation
      {...column({ status: { hidden: false, message: "preparing" } })}
    />,
  );
  const line = within(scrollPane(container)).getByRole("status");
  assert.equal(line.getAttribute("data-nav-status"), "");
  assert.equal(line.hasAttribute("hidden"), false);
  const text = line.querySelector("[data-nav-status-text]");
  assert.equal(text?.className, "mbk-nav-status-text mbk-reset");
  assert.deepEqual(
    [...(text?.children ?? [])].map((part) => [
      part.className,
      part.textContent,
    ]),
    [
      ["mbk-nav-status-title mbk-reset", "Preparing comparison"],
      [
        "mbk-nav-status-detail mbk-reset",
        "This takes a moment. You can keep browsing All while it finishes.",
      ],
    ],
  );
  assert.equal(
    line.firstElementChild?.outerHTML,
    '<span class="mbk-nav-spinner mbk-reset" aria-hidden="true"></span>',
  );

  const words: [NavigationStatusMessage, string, boolean][] = [
    ["pending", "Checking for changes…", true],
    ["none", "No changes found.", false],
    ["unmatched", "No matching changes.", false],
    [
      "unavailable",
      "Changes are unavailable. You can still browse All.",
      false,
    ],
  ];
  for (const [message, wording, spinner] of words) {
    rerender(
      <CatalogueNavigation
        {...column({ status: { hidden: true, message } })}
      />,
    );
    assert.equal(line.hasAttribute("hidden"), true, message);
    const shown = line.querySelector("[data-nav-status-text]");
    assert.equal(shown?.textContent, wording, message);
    assert.equal(shown?.getAttribute("class"), "mbk-reset", message);
    assert.equal(
      line.querySelector(".mbk-nav-spinner") !== null,
      spinner,
      message,
    );
  }
});

test("the tree reports that it waits, and the refs reach the column and the tree", () => {
  const nav = createRef<HTMLElement>();
  const tree = createRef<HTMLDivElement>();
  const { container } = render(
    <CatalogueNavigation
      {...column({ busy: true, ref: nav, scrollRef: tree })}
    />,
  );
  assertSameElement(nav.current, screen.getByRole("navigation"));
  assertSameElement(tree.current, scrollPane(container));
  assert.equal(tree.current?.getAttribute("aria-busy"), "true");
});

test("the scrolling pane holds the status line, then the tree, which reports through the column", () => {
  const choices: [string, boolean][] = [];
  const { container } = render(
    <CatalogueNavigation
      {...column({
        onDisclosure: (key, open) => choices.push([key, open]),
        sections: [
          specs([leaf(link("home"), { variants: [link("home/empty")] })]),
        ],
        status: { hidden: true, message: "none" },
      })}
    />,
  );
  assert.deepEqual(
    [...scrollPane(container).children].map((child) => child.className),
    ["mbk-nav-status mbk-reset", "mbk-nav-section mbk-reset"],
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Show variants of home" }),
  );
  assert.deepEqual(choices, [["variants:home", true]]);
});
