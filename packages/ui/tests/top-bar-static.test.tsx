import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { TopBar } from "../src/top-bar/top-bar.js";

const IDS = { searchId: "root-mb-search" };

function bar(container: HTMLElement): HTMLElement {
  const header = container.querySelector("header");
  assert.ok(header);
  return header;
}

test("the brand links to its address, and to the catalogue home without one", () => {
  const { rerender } = render(<TopBar {...IDS} />);
  assert.equal(
    screen.getByRole("link", { name: "Mokly" }).getAttribute("href"),
    "/",
  );
  rerender(<TopBar {...IDS} brandHref="../home/" />);
  const brand = screen.getByRole("link", { name: "Mokly" });
  assert.equal(brand.getAttribute("href"), "../home/");
  assert.equal(brand.className, "mbk-brand mbk-reset");
  assert.equal(brand.textContent, "mokly.");
});

test("a bar that is not interactive draws its brand as a picture and its search parts as native controls", () => {
  const { container } = render(
    <TopBar
      {...IDS}
      end={<span data-end="" />}
      interactive={false}
      query="tag:forms"
      tagPicker={<span data-picker="" />}
    />,
  );
  const header = bar(container);
  // No control in the bar acts without a script, and the bar draws no menu,
  // as the shell's bar does. The compact search's toggle is the one button: a
  // native button that names the field it would open, as a narrow bar shows
  // it. A static search never opens, so Close search is left out.
  const [toggle, ...others] = within(header).queryAllByRole("button");
  assert.deepEqual(others, []);
  assert.ok(toggle);
  assert.equal(toggle.className, "mbk-search-toggle mbk-reset");
  assert.equal(toggle.getAttribute("aria-label"), "Search catalogue");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toggle.getAttribute("aria-controls"), "root-mb-search");
  // The toggle has no handler, so a press leaves the search closed.
  fireEvent.click(toggle);
  assert.equal(header.getAttribute("data-compact-search"), "closed");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.deepEqual(within(header).queryAllByRole("link"), []);
  assert.equal(header.querySelector("[data-mokly-menu]"), null);
  const brand = within(header).getByRole("img", { name: "Mokly" });
  assert.equal(brand.className, "mbk-brand mbk-reset");
  assert.equal(brand.textContent, "mokly.");
  assert.equal(header.querySelector(".mbk-search-close"), null);
  const field = within(header).getByRole("searchbox", {
    name: "Search catalogue",
  });
  assert.ok(field instanceof HTMLInputElement);
  assert.equal(field.value, "tag:forms");
  assert.equal(field.id, "root-mb-search");
  assert.ok(header.querySelector(".mbk-search > [data-picker]"));
  // The end control ends the bar's end column, which ends the bar.
  assert.ok(
    header.lastElementChild?.lastElementChild?.hasAttribute("data-end"),
  );
});

test("a bar that is not interactive keeps the address it is given", () => {
  render(<TopBar {...IDS} brandHref="../home/" interactive={false} />);
  assert.equal(
    screen.getByRole("link", { name: "Mokly" }).getAttribute("href"),
    "../home/",
  );
  assert.deepEqual(screen.queryAllByRole("img"), []);
});
