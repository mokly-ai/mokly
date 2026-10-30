import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";

import type { EmptyStateRoot } from "../src/empty-state/empty-state.js";
import { RootState } from "../src/shell-layout/shell-layout.js";

import { assertSameElement } from "./dom-assertions.js";

const STANDALONE: EmptyStateRoot = { kind: "standalone", theme: "auto" };
const EMBEDDED: EmptyStateRoot = { kind: "embedded", theme: "dark" };
const VERSION = "This catalogue needs a compatible viewer";
const noop = () => undefined;

test("a loading root is one busy, focusable status line", () => {
  const focus = () => undefined;
  assert.equal(
    renderToString(
      <RootState focusRef={focus} root={STANDALONE} state="loading" />,
    ),
    '<div aria-busy="true" class="mbk mbk-empty mbk-reset" tabindex="-1" data-mokly-theme="auto"><p class="mbk-reset" role="status">Loading catalogue…</p></div>',
  );
  assert.equal(
    renderToString(
      <RootState focusRef={focus} root={EMBEDDED} state="loading" />,
    ),
    '<div aria-busy="true" class="mbk mokly-viewer mbk-empty mbk-reset" tabindex="-1" data-mokly-theme="dark"><p class="mbk-reset" role="status">Loading catalogue…</p></div>',
  );
  const state = createRef<HTMLDivElement>();
  render(<RootState focusRef={state} root={STANDALONE} state="loading" />);
  assertSameElement(state.current, screen.getByRole("status").parentElement);
  state.current?.focus();
  assertSameElement(document.activeElement, state.current);
});

test("a root whose catalogue failed offers Try again under its headline", () => {
  assert.equal(
    renderToString(
      <RootState onRetry={noop} root={STANDALONE} state="failed" />,
    ),
    '<div class="mbk mbk-empty mbk-reset" role="alert" data-mokly-theme="auto"><h2 class="mbk-reset">The catalogue could not be loaded</h2><button class="mbk-empty-link mbk-reset" type="button">Try again</button></div>',
  );
  assert.equal(
    renderToString(<RootState onRetry={noop} root={EMBEDDED} state="failed" />),
    '<div class="mbk mokly-viewer mbk-empty mbk-reset" role="alert" data-mokly-theme="dark"><h2 class="mbk-reset">The catalogue could not be loaded</h2><button class="mbk-empty-link mbk-reset" type="button">Try again</button></div>',
  );
  let retries = 0;
  render(
    <RootState
      onRetry={() => {
        retries += 1;
      }}
      root={STANDALONE}
      state="failed"
    />,
  );
  const alert = screen.getByRole("alert");
  assert.ok(
    screen.getByRole("heading", { name: "The catalogue could not be loaded" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  assert.equal(retries, 1);
  assert.equal(alert.hasAttribute("tabindex"), false);
});

test("the standalone version failure offers Reload, and an embedded one only its headline", () => {
  assert.equal(
    renderToString(
      <RootState
        message={VERSION}
        onReload={noop}
        root={STANDALONE}
        state="version"
      />,
    ),
    `<div class="mbk mbk-empty mbk-reset" data-mokly-version-error="" role="alert" data-mokly-theme="auto"><h2 class="mbk-reset">${VERSION}</h2><button class="mbk-empty-link mbk-reset" type="button">Reload</button></div>`,
  );
  assert.equal(
    renderToString(
      <RootState message={VERSION} root={EMBEDDED} state="version" />,
    ),
    `<div class="mbk mokly-viewer mbk-empty mbk-reset" role="alert" data-mokly-theme="dark"><h2 class="mbk-reset">${VERSION}</h2></div>`,
  );
  let reloads = 0;
  render(
    <RootState
      message={VERSION}
      onReload={() => {
        reloads += 1;
      }}
      root={STANDALONE}
      state="version"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  assert.equal(reloads, 1);
});

test("an unavailable view is one alert sentence without a paragraph", () => {
  assert.equal(
    renderToString(<RootState root={EMBEDDED} state="unavailable" />),
    '<div class="mbk mokly-viewer mbk-empty mbk-reset" role="alert" data-mokly-theme="dark">The requested view is unavailable.</div>',
  );
  render(
    <RootState
      root={{ kind: "embedded", theme: "auto" }}
      state="unavailable"
    />,
  );
  const alert = screen.getByRole("alert");
  assert.equal(alert.textContent, "The requested view is unavailable.");
  assert.equal(alert.getAttribute("data-mokly-theme"), "auto");
});
