import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { ScreenHeader } from "../src/screen-header/screen-header.js";

const CRUMBS = [
  { href: "../home/", label: "Catalogue home" },
  { folder: { path: "example" }, label: "Example" },
  { label: "Screens" },
] as const;

test("a header that is not interactive draws the path chip as a picture and a folder crumb as text", () => {
  const calls: unknown[][] = [];
  const { container } = render(
    <ScreenHeader
      action={<span data-action="" />}
      crumbs={CRUMBS}
      heading="Welcome"
      interactive={false}
      onCopyPath={(path) => calls.push(["copy", path])}
      onRevealFolder={(crumb) => calls.push(["reveal", crumb.label])}
      path="example/screens/welcome"
      status={<span data-status="" />}
    />,
  );
  // No control of the header acts without a script.
  assert.deepEqual(screen.queryAllByRole("button"), []);
  const trail = screen.getByLabelText("Catalogue location");
  assert.equal(
    within(trail)
      .getByRole("link", { name: "Catalogue home" })
      .getAttribute("href"),
    "../home/",
  );
  assert.equal(trail.textContent, "Catalogue home›Example›Screens");

  const chip = container.querySelector<HTMLElement>(".mbk-pathchip");
  assert.ok(chip);
  assert.equal(chip.tagName, "SPAN");
  assert.equal(chip.textContent, "example/screens/welcome");
  assert.equal(chip.getAttribute("data-copy-path"), "example/screens/welcome");
  assert.equal(chip.getAttribute("tabindex"), null);
  fireEvent.click(chip);
  assert.deepEqual(calls, []);

  // The status follows the chip, and the action ends the header.
  assert.ok(chip.nextElementSibling?.hasAttribute("data-status"));
  assert.ok(
    container
      .querySelector(".mbk-screen-head")
      ?.lastElementChild?.hasAttribute("data-action"),
  );
});

test("an interactive header keeps its chip button and folder reveal", () => {
  const calls: unknown[][] = [];
  render(
    <ScreenHeader
      crumbs={CRUMBS}
      heading="Welcome"
      onCopyPath={(path) => calls.push(["copy", path])}
      onRevealFolder={(crumb) => calls.push(["reveal", crumb.label])}
      path="example/screens/welcome"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Example" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Copy path example/screens/welcome" }),
  );
  assert.deepEqual(calls, [
    ["reveal", "Example"],
    ["copy", "example/screens/welcome"],
  ]);
});
