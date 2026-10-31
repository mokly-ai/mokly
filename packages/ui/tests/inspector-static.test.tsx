import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceIcon } from "../src/icons/icons.js";
import {
  Inspector,
  type InspectorTab,
  type InspectorTabId,
} from "../src/inspector/inspector.js";

const GROUP = "root-mb-inspector-content";

function tab(id: InspectorTabId, title: string, href?: string): InspectorTab {
  return {
    href,
    id,
    panel: <p>{`${title} panel`}</p>,
    panelId: `root-mb-panel-${id}`,
    tabId: `root-mb-tab-${id}`,
    title,
  };
}

const glyph = (name: Parameters<typeof WorkspaceIcon>[0]["name"]) =>
  renderToStaticMarkup(<WorkspaceIcon name={name} />);

test("a static inspector draws each tab as a native disclosure of one group", () => {
  assert.equal(
    renderToStaticMarkup(
      <Inspector
        active="details"
        contentId={GROUP}
        disclosures
        interactive={false}
        open
        tabs={[tab("details", "Details")]}
      />,
    ),
    '<section aria-label="Inspector" class="mbk-inspector mbk-reset" data-inspector-disclosures="" data-workspace-inspector="" style="--inspector-tabs:1">' +
      '<div aria-hidden="true" class="mbk-inspector-resize mbk-reset" data-inspector-resize=""></div>' +
      '<label class="mbk-sheet-grab mbk-reset" data-inspector-size="" title="Expand or collapse inspector"><input aria-label="Expanded inspector" class="mbk-reset" role="switch" type="checkbox"/><span class="mbk-reset"></span></label>' +
      `<details class="mbk-reset" data-inspector-tab="details" name="${GROUP}" open="" style="--inspector-tab:1">` +
      `<summary class="mbk-icon-button mbk-reset" id="root-mb-tab-details" title="Details" aria-label="Details" role="button">${glyph("details")}` +
      `<span aria-hidden="true" class="mbk-icon-button mbk-reset" data-inspector-close="" title="Close inspector">${glyph("close")}</span></summary>` +
      '<span class="mbk-inspector-title mbk-reset" data-inspector-title="">Details</span>' +
      '<div class="mbk-inspector-content mbk-reset" data-mokly-scroll="inspector"><section aria-label="Details" class="mbk-reset" data-inspector-panel="details" id="root-mb-panel-details"><p>Details panel</p></section></div>' +
      "</details></section>",
  );
});

test("the open tab is the one disclosure that starts open, and a closed inspector opens none", () => {
  const tabs = [
    tab("details", "Details"),
    tab("props", "Props"),
    tab("usage", "Usage"),
  ];
  const { rerender } = render(
    <Inspector
      active="props"
      contentId={GROUP}
      disclosures
      interactive={false}
      open
      tabs={tabs}
    />,
  );
  const inspector = screen.getByRole("region", { name: "Inspector" });
  const disclosures = [...inspector.querySelectorAll("details")];
  assert.deepEqual(
    disclosures.map((item) => [
      item.getAttribute("data-inspector-tab"),
      item.getAttribute("name"),
      item.open,
    ]),
    [
      ["details", GROUP, false],
      ["props", GROUP, true],
      ["usage", GROUP, false],
    ],
  );
  assert.equal(inspector.hasAttribute("data-open"), false);
  rerender(
    <Inspector
      active="props"
      contentId={GROUP}
      disclosures
      interactive={false}
      open={false}
      tabs={tabs}
    />,
  );
  assert.deepEqual(
    [...inspector.querySelectorAll("details")].map((item) => item.open),
    [false, false, false],
  );
});

test("each tab is a button named by its title, and Close and the separator are pictures", () => {
  const changes: unknown[] = [];
  render(
    <Inspector
      active="details"
      contentId={GROUP}
      disclosures
      interactive={false}
      onOpenChange={(...args) => changes.push(args)}
      open
      tabs={[tab("details", "Details"), tab("usage", "Usage")]}
    />,
  );
  assert.deepEqual(
    screen.getAllByRole("button").map((button) => button.tagName),
    ["SUMMARY", "SUMMARY"],
  );
  assert.deepEqual(
    screen.queryAllByRole("tab").map((element) => element.textContent),
    [],
  );
  assert.deepEqual(
    screen.queryAllByRole("separator").map((element) => element.textContent),
    [],
  );
  const usage = screen.getByRole("button", { name: "Usage" });
  fireEvent.click(usage);
  // The disclosure acts by itself, so the host hears nothing.
  assert.deepEqual(changes, []);
  const separator = document.querySelector("[data-inspector-resize]");
  assert.equal(separator?.getAttribute("aria-hidden"), "true");
  assert.equal(separator?.hasAttribute("tabindex"), false);
  const close = within(
    screen.getByRole("button", { name: "Details" }),
  ).getByTitle("Close inspector");
  assert.equal(close.getAttribute("aria-hidden"), "true");
  assert.equal(close.tagName, "SPAN");
});

test("a tab with an address is a link, which is its one keyboard stop", () => {
  render(
    <Inspector
      contentId={GROUP}
      disclosures
      interactive={false}
      open={false}
      tabs={[tab("details", "Details", "../details-open/")]}
    />,
  );
  const link = screen.getByRole("link", { name: "Details" });
  assert.equal(link.getAttribute("href"), "../details-open/");
  assert.equal(link.className, "mbk-inspector-link mbk-reset");
  const summary = link.closest("summary");
  assert.equal(summary?.getAttribute("tabindex"), "-1");
  assert.equal(summary?.hasAttribute("role"), false);
  assert.equal(summary?.hasAttribute("aria-label"), false);
  assert.deepEqual(
    screen.queryAllByRole("button").map((element) => element.textContent),
    [],
  );
});

test("the sheet's grab is a native switch that starts at the sheet's size", () => {
  const grab = (expanded: boolean) => {
    const { unmount } = render(
      <Inspector
        active="details"
        contentId={GROUP}
        disclosures
        expanded={expanded}
        interactive={false}
        open
        tabs={[tab("details", "Details")]}
      />,
    );
    const checked = (
      screen.getByRole("switch", {
        name: "Expanded inspector",
      }) as HTMLInputElement
    ).checked;
    unmount();
    return checked;
  };
  assert.equal(grab(true), true);
  assert.equal(grab(false), false);
});
