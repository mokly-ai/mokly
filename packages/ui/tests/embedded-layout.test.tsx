import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ComponentProps } from "react";
import { renderToString } from "react-dom/server";

import {
  EmbeddedLayout,
  MarkerLayer,
} from "../src/embedded-layout/embedded-layout.js";

import { assertSameElement } from "./dom-assertions.js";

type LayoutProps = ComponentProps<typeof EmbeddedLayout>;

/** An embedded root with marked content in place of the shell's parts. */
function layout(props: Partial<LayoutProps> = {}) {
  return (
    <EmbeddedLayout
      announcement="Opened Home"
      colorScheme="light"
      drawerOpen={false}
      emptyStateShown={false}
      main={<main id="x-mb-main">Routed</main>}
      mainHref="#x-mb-main"
      markerLayer={<MarkerLayer markers={[]} />}
      navigation={<nav aria-label="Catalogue" />}
      statusId="x-mb-status"
      theme="auto"
      topBar={<header>Top bar</header>}
      {...props}
    />
  );
}

test("an embedded root lays out the shell's parts between its host slots", () => {
  assert.equal(
    renderToString(layout()),
    '<div class="mbk mokly-viewer mbk-reset" data-drawer="closed" data-mokly-color-scheme="light" data-mokly-shell="" tabindex="-1" data-mokly-theme="auto"><a class="mbk-skip-link mbk-reset" href="#x-mb-main">Skip to content</a><div class="mokly-top-host mbk-reset"><div data-mokly-slot="topBarStart"></div><header>Top bar</header><div data-mokly-slot="topBarEnd"></div></div><div class="mbk-body mbk-reset"><div class="mokly-rail-host mbk-reset"><div data-mokly-slot="railStart"></div><nav aria-label="Catalogue"></nav><div data-mokly-slot="railEnd"></div></div><div class="mokly-stage-host mbk-reset"><main id="x-mb-main">Routed</main><div data-mokly-slot="emptyState" hidden=""></div><div data-mokly-slot="stageOverlay" hidden="" style="pointer-events:none"></div></div><div data-mokly-slot="sidePanel"></div></div><div data-mokly-marker-layer="" data-mokly-slot="markers"></div><div class="mbk-reset" data-mokly-label-layer=""></div><p aria-atomic="true" aria-live="polite" class="mbk-route-status mbk-reset" id="x-mb-status" role="status">Opened Home</p></div>',
  );
  assert.match(
    renderToString(
      layout({ colorScheme: "dark", drawerOpen: true, theme: "light" }),
    ),
    /^<div class="mbk mokly-viewer mbk-reset" data-drawer="open" data-mokly-color-scheme="dark" data-mokly-shell="" tabindex="-1" data-mokly-theme="light">/u,
  );
});

test("the embedded root marks a separator drag and an expanded window for the stylesheets", () => {
  assert.match(
    renderToString(layout({ frameExpanded: true, resizing: "navigation" })),
    /^<div class="mbk mokly-viewer mbk-nav-resizing frame-expanded mbk-reset" /u,
  );
});

test("each host slot holds the host's own content in its place", () => {
  const start = createRef<HTMLButtonElement>();
  const { container } = render(
    layout({
      slots: {
        topBarStart: (
          <button ref={start} type="button">
            Start
          </button>
        ),
        topBarEnd: <b>End</b>,
        railStart: <p>Above</p>,
        railEnd: <p>Below</p>,
        sidePanel: { content: <p>Discussion</p>, width: 320 },
        stageOverlay: { content: <span>Note</span>, pointerEvents: "auto" },
        emptyState: <p>Choose a screen</p>,
      },
    }),
  );
  const slot = (name: string) =>
    container.querySelector(`[data-mokly-slot="${name}"]`);
  assertSameElement(start.current?.parentElement, slot("topBarStart"));
  for (const [name, text] of [
    ["topBarEnd", "End"],
    ["railStart", "Above"],
    ["railEnd", "Below"],
    ["sidePanel", "Discussion"],
    ["stageOverlay", "Note"],
    ["emptyState", "Choose a screen"],
  ] as const)
    assertSameElement(screen.getByText(text).parentElement, slot(name), name);
  assert.equal(slot("sidePanel")?.getAttribute("style"), "width: 320px;");
  assert.equal(
    (slot("stageOverlay") as HTMLElement).style.pointerEvents,
    "auto",
  );
  assertSameElement(
    slot("topBarStart")?.parentElement,
    container.querySelector(".mokly-top-host"),
  );
  assertSameElement(
    slot("railEnd")?.parentElement,
    container.querySelector(".mokly-rail-host"),
  );
});

test("the empty state slot shows only when the host asks for it", () => {
  const { container, rerender } = render(
    layout({ slots: { emptyState: <p>Choose a screen</p> } }),
  );
  const slot = container.querySelector<HTMLElement>(
    '[data-mokly-slot="emptyState"]',
  );
  assert.equal(slot?.hidden, true);
  rerender(
    layout({
      emptyStateShown: true,
      slots: { emptyState: <p>Choose a screen</p> },
    }),
  );
  assert.equal(slot?.hidden, false);
});

test("the root reports clicks and keys, hands its element to the host, and takes a label layer", () => {
  const root = createRef<HTMLDivElement>();
  const events: string[] = [];
  const { container } = render(
    layout({
      labelLayer: <div data-mokly-label-layer="">Inspection</div>,
      onClick: () => events.push("click"),
      onKeyDown: (event) => events.push(event.key),
      ref: root,
    }),
  );
  assertSameElement(root.current, container.firstElementChild);
  fireEvent.click(screen.getByText("Routed"));
  fireEvent.keyDown(root.current!, { key: "Escape" });
  assert.deepEqual(events, ["click", "Escape"]);
  const layers = container.querySelectorAll("[data-mokly-label-layer]");
  assert.equal(layers.length, 1);
  assert.equal(layers[0]?.textContent, "Inspection");
  assert.equal(
    screen.getByRole("link", { name: "Skip to content" }).getAttribute("href"),
    "#x-mb-main",
  );
  assert.equal(screen.getByRole("status").id, "x-mb-status");
});

test("the marker layer places each host marker and lets the pointer through", () => {
  assert.equal(
    renderToString(
      <MarkerLayer
        markers={[
          {
            content: <b>One</b>,
            id: "one",
            rect: { left: 1, top: 2, width: 30, height: 40 },
          },
          { id: "two", rect: { left: 0.5, top: 0, width: 0, height: 4 } },
        ]}
      />,
    ),
    '<div data-mokly-marker-layer="" data-mokly-slot="markers"><div data-mokly-marker="one" style="position:absolute;pointer-events:none;left:1px;top:2px;width:30px;height:40px"><b>One</b></div><div data-mokly-marker="two" style="position:absolute;pointer-events:none;left:0.5px;top:0;width:0;height:4px"></div></div>',
  );
  const layer = createRef<HTMLDivElement>();
  const { container } = render(<MarkerLayer markers={[]} ref={layer} />);
  assertSameElement(layer.current, container.firstElementChild);
});
