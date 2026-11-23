import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { PanelTabBody, PanelTabs } from "../src/panel-tabs/panel-tabs.js";

import { assertSameElement, assertSameList } from "./dom-assertions.js";

const TABS = [
  { id: "inspect", label: "Inspect" },
  { id: "changes", label: "Changes" },
] as const;

test("a static strip draws each tab as a picture, and the selected tab is the current one", () => {
  const chosen: string[] = [];
  render(
    <>
      <PanelTabs
        interactive={false}
        onSelect={(tab) => chosen.push(tab)}
        panelId={(tab) => `body-${tab}`}
        selected="changes"
        tabId={(tab) => `tab-${tab}`}
        tabs={TABS}
      />
      <PanelTabBody id="body-changes" labelledBy="tab-changes">
        Band
      </PanelTabBody>
    </>,
  );
  assertSameElement(screen.queryByRole("tablist"), null);
  const strip = screen.getByRole("group", { name: "Panel" });
  assertSameList(within(strip).queryAllByRole("tab"), []);
  const pictures = within(strip).getAllByRole("img");
  assert.deepEqual(
    pictures.map((picture) => [
      picture.tagName,
      picture.getAttribute("aria-label"),
      picture.getAttribute("title"),
      picture.getAttribute("aria-current"),
      picture.id,
      picture.getAttribute("tabindex"),
    ]),
    [
      ["SPAN", "Inspect", "Inspect", null, "tab-inspect", null],
      ["SPAN", "Changes", "Changes", "true", "tab-changes", null],
    ],
  );
  // The selected tab's picture still names the body that it shows.
  assert.equal(
    screen.getByRole("tabpanel", { name: "Changes" }).textContent,
    "Band",
  );
  fireEvent.click(pictures[0]!);
  fireEvent.keyDown(pictures[1]!, { key: "ArrowRight" });
  assert.deepEqual(chosen, []);
});
