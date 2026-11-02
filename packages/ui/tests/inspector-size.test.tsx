import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { Inspector } from "../src/inspector/inspector.js";

/** The size props that a host passes to an open, interactive inspector. */
type Size = Partial<ComponentProps<typeof Inspector>>;

/** An open, interactive inspector with one tab and the given size. */
function inspector(size: Size) {
  return (
    <Inspector
      active="details"
      contentId="root-mb-inspector-content"
      interactive
      open
      tabs={[
        {
          id: "details",
          panel: <p>Details panel</p>,
          panelId: "root-mb-panel-details",
          tabId: "root-mb-tab-details",
          title: "Details",
        },
      ]}
      {...size}
    />
  );
}

function section(): HTMLElement {
  return screen.getByRole("region", { name: "Inspector" });
}

test("the host's height and bounds size the open inspector and its separator", () => {
  render(inspector({ height: 312.4, maximumHeight: 420, minimumHeight: 46 }));
  assert.equal(
    section().style.getPropertyValue("--inspector-height"),
    "312.4px",
  );
  const separator = screen.getByRole("separator", { name: "Resize inspector" });
  assert.deepEqual(
    ["aria-valuemin", "aria-valuemax", "aria-valuenow"].map((name) =>
      separator.getAttribute(name),
    ),
    ["46", "420", "312"],
  );
});

test("the narrow sheet follows the height of a drag until the host clears it", () => {
  const { rerender } = render(inspector({ sheetHeight: 500 }));
  assert.equal(section().style.height, "500px");
  rerender(inspector({}));
  assert.equal(section().style.height, "");
});

test("the sheet's expanded state marks the inspector and names its grab", () => {
  const { rerender } = render(inspector({ expanded: true }));
  assert.equal(section().getAttribute("data-expanded"), "true");
  const grab = screen.getByRole("button", { name: "Make inspector compact" });
  assert.equal(grab.getAttribute("aria-expanded"), "true");
  rerender(inspector({ expanded: false }));
  assert.equal(section().getAttribute("data-expanded"), "false");
  assert.equal(grab.getAttribute("aria-label"), "Expand inspector");
  assert.equal(grab.getAttribute("aria-expanded"), "false");
});
