import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, useState, type Ref } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceIcon } from "../src/icons/icons.js";
import {
  Inspector,
  type InspectorHandle,
  type InspectorTab,
  type InspectorTabId,
} from "../src/inspector/inspector.js";

import { assertSameElement } from "./dom-assertions.js";

const CONTENT = "root-mb-inspector-content";

function tab(id: InspectorTabId, title: string): InspectorTab {
  return {
    id,
    panel: <p>{`${title} panel`}</p>,
    panelId: `root-mb-panel-${id}`,
    tabId: `root-mb-tab-${id}`,
    title,
  };
}

const TABS = [
  tab("details", "Details"),
  tab("components", "Components"),
  tab("props", "Props"),
  tab("usage", "Usage"),
];

/** One report of the inspector: the open state and the tab it asks for. */
type Report = readonly [boolean, InspectorTabId | undefined];

/** A host that holds the open state and the tab, as the shell's store does. */
function Host({
  handle,
  reports,
}: {
  handle?: Ref<InspectorHandle>;
  reports: Report[];
}) {
  const [state, setState] = useState<{
    active?: InspectorTabId;
    open: boolean;
  }>({ open: false });
  return (
    <Inspector
      active={state.active}
      contentId={CONTENT}
      interactive
      onOpenChange={(open, id) => {
        reports.push([open, id]);
        setState(open && id ? { active: id, open } : { open });
      }}
      open={state.open}
      ref={handle}
      tabs={TABS}
    />
  );
}

function tabButton(name: string): HTMLElement {
  return screen.getByRole("tab", { name });
}

test("a closed inspector keeps the shell's markup", () => {
  assert.equal(
    renderToStaticMarkup(
      <Inspector
        contentId={CONTENT}
        interactive={false}
        open={false}
        tabs={[tab("details", "Details")]}
      />,
    ),
    '<section aria-label="Inspector" class="mbk-inspector mbk-reset" data-workspace-inspector="">' +
      `<div aria-controls="${CONTENT}" aria-label="Resize inspector" aria-orientation="horizontal" aria-valuemax="600" aria-valuemin="160" aria-valuenow="260" class="mbk-inspector-resize mbk-reset" data-inspector-resize="" role="separator" tabindex="0"></div>` +
      '<button aria-expanded="false" aria-label="Expand inspector" class="mbk-sheet-grab mbk-reset" data-inspector-size="" type="button"><span class="mbk-reset"></span></button>' +
      '<div aria-label="Inspector panels" class="mbk-inspector-tabs mbk-reset" role="tablist">' +
      `<button aria-controls="root-mb-panel-details" aria-label="Details" aria-selected="false" class="mbk-icon-button mbk-reset" data-inspector-tab="details" id="root-mb-tab-details" role="tab" title="Details" type="button">${renderToStaticMarkup(<WorkspaceIcon name="details" />)}</button>` +
      '<span class="mbk-inspector-title mbk-reset" data-inspector-title=""></span>' +
      `<button aria-label="Close inspector" class="mbk-icon-button mbk-reset" data-inspector-close="" hidden="" title="Close inspector" type="button">${renderToStaticMarkup(<WorkspaceIcon name="close" />)}</button>` +
      "</div>" +
      `<div class="mbk-inspector-content mbk-reset" data-mokly-scroll="inspector" hidden="" id="${CONTENT}">` +
      '<section aria-labelledby="root-mb-tab-details" class="mbk-reset" data-inspector-panel="details" hidden="" id="root-mb-panel-details" role="tabpanel"><p>Details panel</p></section>' +
      "</div></section>",
  );
});

test("the tabs, the panels, and the separator carry the names the shell's specs read", () => {
  render(
    <Inspector
      active="props"
      contentId={CONTENT}
      interactive
      open
      tabs={TABS}
    />,
  );
  const inspector = screen.getByRole("region", { name: "Inspector" });
  assert.equal(inspector.getAttribute("data-open"), "true");
  const tablist = screen.getByRole("tablist", { name: "Inspector panels" });
  assert.deepEqual(
    within(tablist)
      .getAllByRole("tab")
      .map((item) => [
        item.getAttribute("aria-label"),
        item.getAttribute("aria-selected"),
      ]),
    [
      ["Details", "false"],
      ["Components", "false"],
      ["Props", "true"],
      ["Usage", "false"],
    ],
  );
  const panel = screen.getByRole("tabpanel", { name: "Props" });
  assert.equal(panel.textContent, "Props panel");
  assert.equal(panel.id, tabButton("Props").getAttribute("aria-controls"));
  assert.equal(screen.queryAllByRole("tabpanel").length, 1);
  assert.equal(
    inspector.querySelector("[data-inspector-title]")?.textContent,
    "Props",
  );
  assert.equal(
    screen.getByRole("button", { name: "Close inspector" }).hidden,
    false,
  );
  const separator = screen.getByRole("separator", { name: "Resize inspector" });
  assert.equal(separator.getAttribute("aria-controls"), CONTENT);
  assert.equal(separator.getAttribute("aria-orientation"), "horizontal");
  assert.ok(screen.getByRole("button", { name: "Expand inspector" }));
});

test("a closed inspector selects no tab, shows no panel, and marks its state only with a script", () => {
  const { rerender } = render(
    <Inspector
      active="props"
      contentId={CONTENT}
      interactive={false}
      open={false}
      tabs={TABS}
    />,
  );
  const inspector = screen.getByRole("region", { name: "Inspector" });
  assert.equal(inspector.hasAttribute("data-open"), false);
  assert.ok(
    screen
      .getAllByRole("tab")
      .every((item) => item.getAttribute("aria-selected") === "false"),
  );
  assert.equal(screen.queryAllByRole("tabpanel").length, 0);
  assert.equal(
    inspector.querySelector("[data-inspector-title]")?.textContent,
    "",
  );
  assert.equal(
    inspector.querySelector<HTMLElement>("[data-inspector-close]")?.hidden,
    true,
  );
  rerender(
    <Inspector
      active="props"
      contentId={CONTENT}
      interactive
      open={false}
      tabs={TABS}
    />,
  );
  assert.equal(inspector.getAttribute("data-open"), "false");
});

test("a tab opens its panel, and the open tab closes the inspector", () => {
  const reports: Report[] = [];
  render(<Host reports={reports} />);
  fireEvent.click(tabButton("Usage"));
  assert.equal(
    screen.getByRole("tabpanel", { name: "Usage" }).textContent,
    "Usage panel",
  );
  fireEvent.click(tabButton("Details"));
  fireEvent.click(tabButton("Details"));
  assert.deepEqual(reports, [
    [true, "usage"],
    [true, "details"],
    [false, "details"],
  ]);
  assert.equal(screen.queryAllByRole("tabpanel").length, 0);
});

test("Close asks to close and returns focus to the tab that the reader pressed last", () => {
  const reports: Report[] = [];
  render(<Host reports={reports} />);
  fireEvent.click(tabButton("Components"));
  fireEvent.click(tabButton("Props"));
  const close = screen.getByRole("button", { name: "Close inspector" });
  close.focus();
  fireEvent.click(close);
  assert.deepEqual(reports.at(-1), [false, undefined]);
  assertSameElement(document.activeElement, tabButton("Props"));
  assert.equal(screen.queryAllByRole("tabpanel").length, 0);
});

test("the handle names the inspector and closes it with the same focus return", () => {
  const reports: Report[] = [];
  const handle = createRef<InspectorHandle>();
  render(<Host handle={handle} reports={reports} />);
  assertSameElement(
    handle.current?.element,
    screen.getByRole("region", { name: "Inspector" }),
  );
  // Before a tab is pressed, a close moves no focus.
  const outside = document.body;
  handle.current?.close();
  assert.deepEqual(reports, [[false, undefined]]);
  assertSameElement(document.activeElement, outside);
  fireEvent.click(tabButton("Usage"));
  screen.getByRole("tabpanel", { name: "Usage" }).focus();
  handle.current?.close();
  assert.deepEqual(reports.slice(1), [
    [true, "usage"],
    [false, undefined],
  ]);
  assertSameElement(document.activeElement, tabButton("Usage"));
});

test("the arrow keys step and wrap between the tabs, and Home and End choose the ends", () => {
  render(<Host reports={[]} />);
  tabButton("Details").focus();
  const steps: readonly (readonly [string, string])[] = [
    ["ArrowRight", "Components"],
    ["ArrowRight", "Props"],
    ["ArrowRight", "Usage"],
    ["ArrowRight", "Details"],
    ["ArrowLeft", "Usage"],
    ["ArrowLeft", "Props"],
    ["Home", "Details"],
    ["End", "Usage"],
  ];
  for (const [key, name] of steps) {
    const active = document.activeElement;
    assert.ok(active instanceof HTMLElement);
    // fireEvent returns false when the inspector prevented the default.
    assert.equal(fireEvent.keyDown(active, { key }), false, key);
    assertSameElement(
      document.activeElement,
      tabButton(name),
      `${key} → ${name}`,
    );
  }
});

test("another key, or a key outside the tabs, keeps its default and moves nothing", () => {
  render(<Host reports={[]} />);
  fireEvent.click(tabButton("Props"));
  const props = tabButton("Props");
  props.focus();
  for (const key of ["Enter", "ArrowDown", "a", "Tab"]) {
    assert.equal(fireEvent.keyDown(props, { key }), true, key);
    assertSameElement(document.activeElement, props, key);
  }
  const panel = screen.getByRole("tabpanel", { name: "Props" });
  panel.tabIndex = -1;
  panel.focus();
  assert.equal(fireEvent.keyDown(panel, { key: "ArrowRight" }), true);
  assertSameElement(document.activeElement, panel);
});
