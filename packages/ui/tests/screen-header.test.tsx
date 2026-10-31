import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { ScreenHeader } from "../src/screen-header/screen-header.js";

/** A host crumb that carries more than the header reads. */
interface HostCrumb {
  href?: string;
  folder?: { path: string; section: "specs" | "components" };
  label: string;
}

const CRUMBS: readonly HostCrumb[] = [
  { href: "/view/product/", label: "Product overview" },
  { folder: { path: "product/browse", section: "specs" }, label: "Browse" },
  { label: "Archive" },
];

function location(): HTMLElement {
  return screen.getByLabelText("Catalogue location");
}

test("the crumbs are a link, a folder button, and text, with separators between", () => {
  const markup = renderToStaticMarkup(
    <ScreenHeader crumbs={CRUMBS} heading="Home" />,
  );
  assert.match(
    markup,
    /^<div class="mbk-screen-head"><div class="mbk-screen-head-copy"><p aria-label="Catalogue location" class="mbk-crumbs">/,
  );
  assert.match(
    markup,
    /<span><a class="mbk-crumb-link" href="\/view\/product\/">Product overview<\/a><\/span><span><span class="sep">›<\/span><button class="mbk-crumb-link" data-crumb-folder="product\/browse" type="button">Browse<\/button><\/span><span><span class="sep">›<\/span>Archive<\/span><\/p>/,
  );
  render(<ScreenHeader crumbs={CRUMBS} heading="Home" />);
  const trail = location();
  assert.equal(trail.tagName, "P");
  assert.equal(
    within(trail).getByRole("link", { name: "Product overview" }).tagName,
    "A",
  );
  assert.ok(within(trail).getByRole("button", { name: "Browse" }));
  assert.equal(trail.textContent, "Product overview›Browse›Archive");
});

test("a folder crumb reports the host's own crumb record", () => {
  const revealed: HostCrumb[] = [];
  render(
    <ScreenHeader
      crumbs={CRUMBS}
      heading="Home"
      onRevealFolder={(crumb) => revealed.push(crumb)}
    />,
  );
  fireEvent.click(within(location()).getByRole("button", { name: "Browse" }));
  assert.deepEqual(revealed, [CRUMBS[1]]);
  assert.equal(revealed[0], CRUMBS[1]);
});

test("the title row holds the heading, the path chip, and the status in order", () => {
  const { container } = render(
    <ScreenHeader
      crumbs={[]}
      heading="Checkout"
      path="flows/checkout"
      status={<span data-status="Changed">Changed</span>}
    />,
  );
  assert.ok(screen.getByRole("heading", { level: 2, name: "Checkout" }));
  const row = container.querySelector(".mbk-title-row");
  assert.ok(row);
  assert.deepEqual(
    [...row.children].map((child) => child.tagName),
    ["H2", "BUTTON", "SPAN"],
  );
  const chip = screen.getByRole("button", {
    name: "Copy path flows/checkout",
  });
  assert.equal(chip.className, "mbk-pathchip");
  assert.equal(chip.getAttribute("data-copy-path"), "flows/checkout");
  assert.equal(chip.textContent, "flows/checkout");
  assert.equal(location().childElementCount, 0);
});

test("the path chip reports the path, and a header without a path has no chip", () => {
  const copied: string[] = [];
  const { rerender } = render(
    <ScreenHeader
      crumbs={[]}
      heading="Card"
      onCopyPath={(path) => copied.push(path)}
      path="components/card"
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Copy path components/card" }),
  );
  assert.deepEqual(copied, ["components/card"]);
  rerender(<ScreenHeader crumbs={[]} heading="Card" path="" />);
  assert.equal(screen.queryByRole("button"), null);
});

test("the action follows the copy at the end of the header", () => {
  const { container } = render(
    <ScreenHeader
      action={<span aria-label="Viewport" role="group" />}
      crumbs={[{ label: "Specs" }]}
      heading="Home"
    />,
  );
  const header = container.firstElementChild;
  assert.ok(header instanceof HTMLElement);
  assert.equal(header.className, "mbk-screen-head");
  assert.deepEqual(
    [...header.children].map((child) => child.className || child.tagName),
    ["mbk-screen-head-copy", "SPAN"],
  );
  assert.ok(within(header).getByRole("group", { name: "Viewport" }));
});
