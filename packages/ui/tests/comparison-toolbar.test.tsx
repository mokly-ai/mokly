import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ComparisonToolbar,
  type ComparisonMode,
} from "../src/comparison-toolbar/comparison-toolbar.js";

/** The props of one band; every callback records into `calls`. */
function props(
  mode: ComparisonMode,
  options: { eligible?: boolean; loaded?: boolean; together?: boolean } = {},
  calls: unknown[][] = [],
) {
  return {
    current: mode === "current",
    eligible: options.eligible ?? true,
    loaded: options.loaded ?? true,
    mode,
    onMode: (value: ComparisonMode) => calls.push(["mode", value]),
    onRefresh: () => calls.push(["refresh"]),
    onTogether: (on: boolean) => calls.push(["together", on]),
    together: options.together ?? true,
  };
}

function band(
  mode: ComparisonMode,
  options: { loaded?: boolean; together?: boolean } = {},
): string {
  return renderToStaticMarkup(<ComparisonToolbar {...props(mode, options)} />);
}

const SWITCH =
  /<label class="mbk-diff-sync"( hidden="")?><input data-diff-scroll-together="" role="switch" type="checkbox"( checked="")?\/><span aria-hidden="true" class="mbk-diff-sync-track"><\/span>Scroll together<\/label>/;

test("Scroll together sits between the modes and Refresh in every diff mode", () => {
  for (const mode of ["side", "overlay", "difference"] as const) {
    const markup = band(mode);
    const match = SWITCH.exec(markup);
    assert.ok(match, mode);
    assert.equal(match[1], undefined, `${mode}: shown`);
    assert.equal(match[2], ' checked=""', `${mode}: on`);
    assert.ok(markup.indexOf("mbk-seg") < markup.indexOf("mbk-diff-sync"));
    assert.ok(
      markup.indexOf("mbk-diff-sync") < markup.indexOf("mbk-diff-refresh"),
    );
  }
});

test("Scroll together shows off, and stays while a comparison loads", () => {
  assert.equal(
    SWITCH.exec(band("overlay", { together: false }))![2],
    undefined,
  );
  const loading = band("side", { loaded: false });
  assert.equal(SWITCH.exec(loading)![1], undefined);
  assert.match(
    loading,
    /class="mbk-diff-refresh" data-diff-refresh="" hidden=""/,
  );
});

test("Current hides Scroll together", () => {
  assert.equal(SWITCH.exec(band("current"))![1], ' hidden=""');
});

test("the mode group presses the shown mode and reports each chosen mode", () => {
  const calls: unknown[][] = [];
  render(<ComparisonToolbar {...props("side", {}, calls)} />);
  const group = screen.getByRole("group", { name: "Comparison mode" });
  const buttons = within(group).getAllByRole("button");
  assert.deepEqual(
    buttons.map((button) => button.textContent),
    ["Current", "Side by side", "Overlay", "Difference"],
  );
  assert.deepEqual(
    buttons.map((button) => button.getAttribute("aria-pressed")),
    ["false", "true", "false", "false"],
  );
  for (const name of ["Overlay", "Difference", "Current"])
    fireEvent.click(within(group).getByRole("button", { name }));
  assert.deepEqual(calls, [
    ["mode", "overlay"],
    ["mode", "difference"],
    ["mode", "current"],
  ]);
});

test("Scroll together and Refresh report through their callbacks in order", () => {
  const calls: unknown[][] = [];
  render(<ComparisonToolbar {...props("overlay", {}, calls)} />);
  const toggle = screen.getByRole("switch", { name: "Scroll together" });
  assert.ok(toggle instanceof HTMLInputElement);
  assert.equal(toggle.checked, true);
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("button", { name: "Refresh comparison" }));
  assert.deepEqual(calls, [["together", false], ["refresh"]]);
});

test("a switch that is off reports on", () => {
  const calls: unknown[][] = [];
  render(<ComparisonToolbar {...props("side", { together: false }, calls)} />);
  const toggle = screen.getByRole("switch", { name: "Scroll together" });
  assert.ok(toggle instanceof HTMLInputElement);
  assert.equal(toggle.checked, false);
  fireEvent.click(toggle);
  assert.deepEqual(calls, [["together", true]]);
});

test("the props hide the band, the switch, and Refresh", () => {
  const { rerender } = render(<ComparisonToolbar {...props("current")} />);
  assert.ok(screen.getByRole("group", { name: "Comparison mode" }));
  assert.equal(screen.queryByRole("switch"), null);
  assert.equal(
    screen.queryByRole("button", { name: "Refresh comparison" }),
    null,
  );

  rerender(<ComparisonToolbar {...props("side", { loaded: false })} />);
  assert.ok(screen.getByRole("switch", { name: "Scroll together" }));
  assert.equal(
    screen.queryByRole("button", { name: "Refresh comparison" }),
    null,
  );

  rerender(<ComparisonToolbar {...props("side")} />);
  assert.ok(screen.getByRole("button", { name: "Refresh comparison" }));

  rerender(<ComparisonToolbar {...props("side", { eligible: false })} />);
  assert.equal(screen.queryByRole("group", { name: "Comparison mode" }), null);
  assert.equal(screen.queryByRole("switch"), null);
  assert.equal(screen.queryByRole("button"), null);
});
