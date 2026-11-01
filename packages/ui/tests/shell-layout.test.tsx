import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";

import { MainRegion, ShellLayout } from "../src/shell-layout/shell-layout.js";

import { assertSameElement } from "./dom-assertions.js";

/** A shell with marked slot content, as the standalone viewer fills it. */
function shell(
  drawerOpen: boolean,
  ref = createRef<HTMLDivElement>(),
  appearance: { theme: "auto" | "dark"; scheme: "dark" | "light" } = {
    theme: "auto",
    scheme: "light",
  },
) {
  return (
    <ShellLayout
      announcement="Opened Home"
      colorScheme={appearance.scheme}
      drawerOpen={drawerOpen}
      main={<MainRegion id="mb-main">Routed view</MainRegion>}
      mainHref="#mb-main"
      navigation={<nav aria-label="Catalogue" />}
      ref={ref}
      statusId="mb-status"
      theme={appearance.theme}
      topBar={<header>Top bar</header>}
    />
  );
}

test("the shell root holds the skip link, the top bar, the body, and the route status", () => {
  assert.equal(
    renderToString(shell(false)),
    '<div class="mbk mbk-reset" data-drawer="closed" data-mokly-color-scheme="light" data-mokly-shell="" data-mokly-theme="auto"><a class="mbk-skip-link mbk-reset" href="#mb-main">Skip to content</a><header>Top bar</header><div class="mbk-body mbk-reset"><nav aria-label="Catalogue"></nav><main class="mbk-main mbk-reset" data-mokly-view="" id="mb-main" tabindex="-1">Routed view</main></div><p aria-atomic="true" aria-live="polite" class="mbk-route-status mbk-reset" id="mb-status" role="status">Opened Home</p></div>',
  );
  assert.match(
    renderToString(shell(true)),
    /^<div class="mbk mbk-reset" data-drawer="open"/u,
  );
});

test("the shell root states its appearance and its preview scheme", () => {
  const { container } = render(
    shell(false, createRef<HTMLDivElement>(), {
      theme: "dark",
      scheme: "dark",
    }),
  );
  const root = container.firstElementChild;
  assert.equal(root?.getAttribute("data-mokly-theme"), "dark");
  assert.equal(root?.getAttribute("data-mokly-color-scheme"), "dark");
});

test("the skip link goes to the main region, and the status announces each navigation", () => {
  const root = createRef<HTMLDivElement>();
  const { container } = render(shell(false, root));
  assertSameElement(root.current, container.firstElementChild);
  assert.equal(
    screen.getByRole("link", { name: "Skip to content" }).getAttribute("href"),
    "#mb-main",
  );
  const main = screen.getByRole("main");
  assert.equal(main.id, "mb-main");
  assert.equal(main.tabIndex, -1);
  assertSameElement(
    screen.getByRole("navigation", { name: "Catalogue" }).nextElementSibling,
    main,
  );
  const status = screen.getByRole("status");
  assert.equal(status.textContent, "Opened Home");
  assert.equal(status.getAttribute("aria-live"), "polite");
  assert.equal(status.getAttribute("aria-atomic"), "true");
});

test("the main region records a removed entry's baseline only when it has one", () => {
  assert.equal(
    renderToString(<MainRegion id="x-mb-main" />),
    '<main class="mbk-main mbk-reset" data-mokly-view="" id="x-mb-main" tabindex="-1"></main>',
  );
  render(
    <MainRegion baseline="abc123" id="mb-main">
      <h2>Removed</h2>
    </MainRegion>,
  );
  const main = screen.getByRole("main");
  assert.equal(main.getAttribute("data-mokly-baseline"), "abc123");
  assert.ok(within(main).getByRole("heading", { name: "Removed" }));
});
