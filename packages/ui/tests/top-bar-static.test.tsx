import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { TopBar } from "../src/top-bar/top-bar.js";

const IDS = { navigationId: "root-mb-nav", searchId: "root-mb-search" };

function bar(container: HTMLElement): HTMLElement {
  const header = container.querySelector("header");
  assert.ok(header);
  return header;
}

test("the brand links to its address, and to the catalogue home without one", () => {
  const { rerender } = render(<TopBar {...IDS} drawerOpen={false} />);
  assert.equal(
    screen.getByRole("link", { name: "Mokly" }).getAttribute("href"),
    "/",
  );
  rerender(<TopBar {...IDS} brandHref="../home/" drawerOpen={false} />);
  const brand = screen.getByRole("link", { name: "Mokly" });
  assert.equal(brand.getAttribute("href"), "../home/");
  assert.equal(brand.className, "mbk-brand");
  assert.equal(brand.textContent, "mokly.");
});

test("a menu with an address is a link named for the drawer state it shows", () => {
  const drawers: boolean[] = [];
  const { rerender } = render(
    <TopBar
      {...IDS}
      drawerOpen={false}
      menuHref="../navigation/"
      onDrawer={(open) => drawers.push(open)}
    />,
  );
  const open = screen.getByRole("link", { name: "Open catalogue navigation" });
  assert.equal(open.getAttribute("href"), "../navigation/");
  assert.equal(open.className, "mbk-menu");
  assert.equal(open.getAttribute("data-mokly-menu"), "");
  // A link reports no expanded state and controls no element of its own.
  assert.equal(open.getAttribute("aria-expanded"), null);
  assert.equal(open.getAttribute("aria-controls"), null);
  fireEvent.click(open);
  assert.deepEqual(drawers, []);

  rerender(<TopBar {...IDS} drawerOpen menuHref="../home/" />);
  const close = screen.getByRole("link", {
    name: "Close catalogue navigation",
  });
  assert.equal(close.getAttribute("href"), "../home/");
  assert.equal(
    screen.queryByRole("button", { name: /catalogue navigation/u }),
    null,
  );
});

test("a bar that is not interactive draws its controls as pictures and keeps its search field", () => {
  const { container } = render(
    <TopBar
      {...IDS}
      drawerOpen
      end={<span data-end="" />}
      interactive={false}
      query="tag:forms"
      tagPicker={<span data-picker="" />}
    />,
  );
  const header = bar(container);
  // No control in the bar acts without a script.
  assert.deepEqual(within(header).queryAllByRole("button"), []);
  assert.deepEqual(within(header).queryAllByRole("link"), []);
  const menu = within(header).getByRole("img", {
    name: "Close catalogue navigation",
  });
  assert.equal(menu.tagName, "SPAN");
  assert.equal(menu.className, "mbk-menu");
  const brand = within(header).getByRole("img", { name: "Mokly" });
  assert.equal(brand.className, "mbk-brand");
  assert.equal(brand.textContent, "mokly.");
  // The compact search needs a script, so its toggle and Close search go.
  assert.equal(header.querySelector(".mbk-search-toggle"), null);
  assert.equal(header.querySelector(".mbk-search-close"), null);
  const field = within(header).getByRole("searchbox", {
    name: "Search catalogue",
  });
  assert.ok(field instanceof HTMLInputElement);
  assert.equal(field.value, "tag:forms");
  assert.equal(field.id, "root-mb-search");
  assert.ok(header.querySelector(".mbk-search > [data-picker]"));
  assert.ok(header.lastElementChild?.hasAttribute("data-end"));
});

test("a bar that is not interactive keeps the addresses it is given", () => {
  render(
    <TopBar
      {...IDS}
      brandHref="../home/"
      drawerOpen={false}
      interactive={false}
      menuHref="../navigation/"
    />,
  );
  assert.equal(
    screen.getByRole("link", { name: "Mokly" }).getAttribute("href"),
    "../home/",
  );
  assert.equal(
    screen
      .getByRole("link", { name: "Open catalogue navigation" })
      .getAttribute("href"),
    "../navigation/",
  );
  assert.deepEqual(screen.queryAllByRole("img"), []);
});
