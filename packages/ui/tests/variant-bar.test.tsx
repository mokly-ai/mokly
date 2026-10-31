import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import {
  VariantBar,
  type VariantBarItem,
} from "../src/variant-bar/variant-bar.js";

const VARIANTS: readonly VariantBarItem[] = [
  {
    current: false,
    href: "/view/c/a/",
    path: "c/a",
    removed: false,
    title: "Alpha",
  },
  {
    current: false,
    href: "/view/c/b/?snapshot=s1",
    path: "c/b",
    removed: true,
    title: "Beta",
  },
  {
    current: true,
    href: "/view/c/c/",
    path: "c/c",
    removed: false,
    title: "Gamma",
  },
];

test("the bar links each saved variant and marks the shown one", () => {
  // renderToString keeps a removed variant's text nodes apart, as the shell
  // renders them.
  assert.equal(
    renderToString(<VariantBar status="Gamma · Changed" variants={VARIANTS} />),
    '<nav aria-label="Saved variants" class="mbk-selection-bar"><span>Variant</span><a data-workspace-variant="c/a" href="/view/c/a/">Alpha</a><a data-workspace-variant="c/b" href="/view/c/b/?snapshot=s1">Beta<!-- --> · Removed</a><a aria-current="page" data-workspace-variant="c/c" href="/view/c/c/">Gamma</a><span class="mbk-variant-status" data-workspace-variant-status="">Gamma · Changed</span></nav>',
  );
});

test("the reader finds the bar and each variant by name", () => {
  render(<VariantBar variants={VARIANTS} />);
  const bar = screen.getByRole("navigation", { name: "Saved variants" });
  const links = within(bar).getAllByRole("link");
  assert.deepEqual(
    links.map((link) => link.textContent),
    ["Alpha", "Beta · Removed", "Gamma"],
  );
  assert.equal(
    within(bar)
      .getByRole("link", { name: "Gamma" })
      .getAttribute("aria-current"),
    "page",
  );
  assert.equal(
    within(bar)
      .getByRole("link", { name: "Beta · Removed" })
      .getAttribute("href"),
    "/view/c/b/?snapshot=s1",
  );
});

test("the status stays in place, hidden and empty, while the variant has none", () => {
  const { container } = render(<VariantBar variants={[]} />);
  const status = container.querySelector("[data-workspace-variant-status]");
  assert.ok(status instanceof HTMLElement);
  assert.equal(status.hidden, true);
  assert.equal(status.textContent, "");
  assert.equal(status.className, "mbk-variant-status");
});

test("a variant without an address is a picture that keeps its mark", () => {
  const variants: readonly VariantBarItem[] = [
    { current: true, href: "../a/", path: "c/a", removed: false, title: "A" },
    { current: false, path: "c/b", removed: false, title: "B" },
    { current: false, path: "c/c", removed: true, title: "C" },
  ];
  assert.equal(
    renderToString(<VariantBar variants={variants} />),
    '<nav aria-label="Saved variants" class="mbk-selection-bar"><span>Variant</span><a aria-current="page" data-workspace-variant="c/a" href="../a/">A</a><span class="mbk-variant-option" data-workspace-variant="c/b">B</span><span class="mbk-variant-option" data-workspace-variant="c/c">C<!-- --> · Removed</span><span class="mbk-variant-status" data-workspace-variant-status="" hidden=""></span></nav>',
  );
  render(
    <VariantBar
      variants={[{ current: true, path: "c/d", removed: false, title: "D" }]}
    />,
  );
  const bar = screen.getByRole("navigation", { name: "Saved variants" });
  assert.equal(within(bar).queryAllByRole("link").length, 0);
  assert.equal(within(bar).getByText("D").getAttribute("aria-current"), "page");
});
