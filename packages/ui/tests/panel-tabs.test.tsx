import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";

import {
  PanelTabBody,
  PanelTabs,
  type PanelTab,
} from "../src/panel-tabs/panel-tabs.js";

import { assertSameElement } from "./dom-assertions.js";

const TABS = [
  { id: "inspect", label: "Inspect" },
  { id: "changes", label: "Changes" },
] as const;

/** A host that holds the selected tab and records each choice. */
function Host({ chosen }: { chosen: PanelTab[] }) {
  const [selected, setSelected] = useState<PanelTab>("inspect");
  return (
    <>
      <PanelTabs
        onSelect={(tab) => {
          chosen.push(tab);
          setSelected(tab);
        }}
        panelId="body"
        selected={selected}
        tabId={(tab) => `tab-${tab}`}
        tabs={TABS}
      />
      <PanelTabBody id="body" labelledBy={`tab-${selected}`}>
        {selected}
      </PanelTabBody>
    </>
  );
}

test("the strip is a tab list named Panel whose selected tab names its panel", () => {
  render(<Host chosen={[]} />);
  const list = screen.getByRole("tablist", { name: "Panel" });
  const tabs = within(list).getAllByRole("tab");
  assert.deepEqual(
    tabs.map((tab) => [tab.textContent, tab.getAttribute("aria-selected")]),
    [
      ["Inspect", "true"],
      ["Changes", "false"],
    ],
  );
  assert.deepEqual(
    tabs.map((tab) => tab.tabIndex),
    [0, -1],
  );
  const panel = screen.getByRole("tabpanel", { name: "Inspect" });
  assert.equal(panel.textContent, "inspect");
  // Each label keeps the width of its bold form.
  assert.equal(
    tabs[1]?.querySelector("[data-text]")?.getAttribute("data-text"),
    "Changes",
  );
});

test("the arrow keys select the next tab and wrap, and Home and End the ends", () => {
  const chosen: PanelTab[] = [];
  render(<Host chosen={chosen} />);
  const tab = (name: string) => screen.getByRole("tab", { name });
  tab("Inspect").focus();
  for (const key of ["ArrowRight", "ArrowRight", "ArrowLeft", "End", "Home"])
    fireEvent.keyDown(document.activeElement!, { key });
  assert.deepEqual(chosen, [
    "changes",
    "inspect",
    "changes",
    "changes",
    "inspect",
  ]);
  assertSameElement(document.activeElement, tab("Inspect"));
  fireEvent.click(tab("Changes"));
  assert.equal(tab("Changes").getAttribute("aria-selected"), "true");
  assert.deepEqual(chosen.at(-1), "changes");
});
