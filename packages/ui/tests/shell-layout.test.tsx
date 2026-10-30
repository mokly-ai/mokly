import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";

import { MainRegion, ShellLayout } from "../src/shell-layout/shell-layout.js";

import { assertSameElement } from "./dom-assertions.js";

/** A shell with marked slot content, as the standalone viewer fills it. */
function shell(drawerOpen: boolean, ref = createRef<HTMLDivElement>()) {
  return (
    <ShellLayout
      announcement="Opened Home"
      drawerOpen={drawerOpen}
      main={<MainRegion id="mb-main">Routed view</MainRegion>}
      mainHref="#mb-main"
      navigation={<nav aria-label="Catalogue" />}
      ref={ref}
      statusId="mb-status"
      topBar={<header>Top bar</header>}
    />
  );
}

test("the shell root holds the skip link, the top bar, the body, and the route status", () => {
  assert.equal(
    renderToString(shell(false)),
    '<div class="mbk" data-drawer="closed" data-mokly-shell=""><a class="mbk-skip-link" href="#mb-main">Skip to content</a><header>Top bar</header><div class="mbk-body"><nav aria-label="Catalogue"></nav><main class="mbk-main" data-mokly-view="" id="mb-main" tabindex="-1">Routed view</main></div><p aria-atomic="true" aria-live="polite" class="mbk-route-status" id="mb-status" role="status">Opened Home</p></div>',
  );
  assert.match(
    renderToString(shell(true)),
    /^<div class="mbk" data-drawer="open"/u,
  );
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
    '<main class="mbk-main" data-mokly-view="" id="x-mb-main" tabindex="-1"></main>',
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
