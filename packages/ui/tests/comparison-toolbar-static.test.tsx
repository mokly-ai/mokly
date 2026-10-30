import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ComparisonToolbar,
  type ComparisonMode,
} from "../src/comparison-toolbar/comparison-toolbar.js";

import { assertSameElement, assertSameList } from "./dom-assertions.js";

/** The props of one band; every callback records into `calls`. */
function props(mode: ComparisonMode, calls: unknown[][] = []) {
  return {
    current: mode === "current",
    eligible: true,
    loaded: true,
    mode,
    onMode: (value: ComparisonMode) => calls.push(["mode", value]),
    onRefresh: () => calls.push(["refresh"]),
    onTogether: (on: boolean) => calls.push(["together", on]),
    together: true,
  };
}

/** An address for every mode except the shown one, like a static artboard. */
function others(shown: ComparisonMode) {
  return (mode: ComparisonMode) =>
    mode === shown ? undefined : `../${mode}/index.html`;
}

test("without an address or interactive, the band keeps its buttons exactly", () => {
  assert.equal(
    renderToStaticMarkup(<ComparisonToolbar {...props("side")} />),
    '<div class="mbk-diff-toolbar"><span aria-label="Comparison mode" class="mbk-seg" role="group"><button aria-pressed="false" data-diff-mode="current" type="button">Current</button><button aria-pressed="true" data-diff-mode="side" type="button">Side by side</button><button aria-pressed="false" data-diff-mode="overlay" type="button">Overlay</button><button aria-pressed="false" data-diff-mode="difference" type="button">Difference</button></span><label class="mbk-diff-sync"><input data-diff-scroll-together="" role="switch" type="checkbox" checked=""/><span aria-hidden="true" class="mbk-diff-sync-track"></span>Scroll together</label><button aria-label="Refresh comparison" class="mbk-diff-refresh" data-diff-refresh="" title="Refresh comparison" type="button"><span aria-hidden="true">↻</span></button></div>',
  );
});

test("a mode with an address is a link, and the shown mode's link is the current page", () => {
  const calls: unknown[][] = [];
  render(
    <ComparisonToolbar
      {...props("overlay", calls)}
      modeHref={(mode) => `#${mode}`}
    />,
  );
  const group = screen.getByRole("group", { name: "Comparison mode" });
  const links = within(group).getAllByRole("link");
  assert.deepEqual(
    links.map((link) => [
      link.textContent,
      link.getAttribute("href"),
      link.getAttribute("aria-current"),
      link.getAttribute("data-diff-mode"),
    ]),
    [
      ["Current", "#current", null, "current"],
      ["Side by side", "#side", null, "side"],
      ["Overlay", "#overlay", "page", "overlay"],
      ["Difference", "#difference", null, "difference"],
    ],
  );
  assertSameList(within(group).queryAllByRole("button"), []);
  fireEvent.click(within(group).getByRole("link", { name: "Difference" }));
  assert.deepEqual(calls, []);
});

test("a mode without an address stays a button that reports the choice beside the links", () => {
  const calls: unknown[][] = [];
  render(
    <ComparisonToolbar {...props("side", calls)} modeHref={others("side")} />,
  );
  const group = screen.getByRole("group", { name: "Comparison mode" });
  assert.deepEqual(
    within(group)
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]),
    [
      ["Current", "../current/index.html"],
      ["Overlay", "../overlay/index.html"],
      ["Difference", "../difference/index.html"],
    ],
  );
  const shown = within(group).getByRole("button", { name: "Side by side" });
  assert.equal(shown.getAttribute("aria-pressed"), "true");
  fireEvent.click(shown);
  assert.deepEqual(calls, [["mode", "side"]]);
});

test("a band that is not interactive draws its other modes and Refresh as inert text", () => {
  const calls: unknown[][] = [];
  const { container } = render(
    <ComparisonToolbar
      {...props("difference", calls)}
      interactive={false}
      modeHref={others("difference")}
    />,
  );
  assertSameList(screen.queryAllByRole("button"), []);
  const group = screen.getByRole("group", { name: "Comparison mode" });
  assert.equal(within(group).getAllByRole("link").length, 3);
  const shown = group.querySelector('[data-diff-mode="difference"]')!;
  assert.equal(shown.tagName, "SPAN");
  assert.equal(shown.textContent, "Difference");
  assert.equal(shown.getAttribute("aria-current"), "page");
  fireEvent.click(shown);
  const refresh = screen.getByRole("img", { name: "Refresh comparison" });
  assert.equal(refresh.tagName, "SPAN");
  assert.equal(refresh.className, "mbk-diff-refresh");
  fireEvent.click(refresh);
  assert.deepEqual(calls, []);
  assert.equal(container.querySelectorAll("[aria-current]").length, 1);
});

test("with no address at all, an inert band marks only the shown mode", () => {
  render(<ComparisonToolbar {...props("current")} interactive={false} />);
  const group = screen.getByRole("group", { name: "Comparison mode" });
  assertSameList(within(group).queryAllByRole("link"), []);
  assert.deepEqual(
    [...group.children].map((mode) => [
      mode.tagName,
      mode.textContent,
      mode.getAttribute("aria-current"),
    ]),
    [
      ["SPAN", "Current", "page"],
      ["SPAN", "Side by side", null],
      ["SPAN", "Overlay", null],
      ["SPAN", "Difference", null],
    ],
  );
  assertSameElement(screen.queryByRole("switch"), null);
  assertSameElement(
    screen.queryByRole("img", { name: "Refresh comparison" }),
    null,
  );
});

test("Scroll together stays a native switch in a band that is not interactive", () => {
  const calls: unknown[][] = [];
  render(
    <ComparisonToolbar {...props("overlay", calls)} interactive={false} />,
  );
  const toggle = screen.getByRole("switch", { name: "Scroll together" });
  assert.ok(toggle instanceof HTMLInputElement);
  assert.equal(toggle.checked, true);
  fireEvent.click(toggle);
  assert.deepEqual(calls, [["together", false]]);
});
