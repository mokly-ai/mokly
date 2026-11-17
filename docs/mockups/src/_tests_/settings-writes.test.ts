/**
 * The writes of the settings panes. While a write runs, the control that sent
 * it carries the wait, as Write in progress in `folio-chrome.md` defines: it
 * keeps its place with its working word and the busy spinner, it stays
 * focusable while it refuses a second press, a screen reader hears the
 * operation, and the pane inserts nothing. A switch has no working word, so
 * the Automatic builds switch shows "Saving…" in its own row.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { sample } from "../fixtures/product";
import type { Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
} from "./design-site-test-helpers";
import {
  actions,
  busyActions,
  busyControl,
  controlStates,
  destination,
  drawnPage,
  links,
  pendingLabels,
} from "./drawn-page";
import type { DrawnPage } from "./drawn-page";
import { writes } from "./settings-write-cases";

const viewports: readonly Viewport[] = ["desktop", "mobile"];
const settings = "product/settings/";

/**
 * The controls at rest with the pressed one relabelled to its working word. A
 * modal's control comes after the pane beneath it, which can draw a control
 * of the same name, so the pressed control is the last one of its name.
 */
function pressed(
  resting: [string, string][],
  control: string,
  working: string,
): [string, string][] {
  const at = resting.map(([, name]) => name).lastIndexOf(control);
  return resting.map(([tone, name], index) => [
    tone,
    index === at ? working : name,
  ]);
}

/** The value one field holds, by the field's id. */
function fieldValues(page: DrawnPage, id: string): (string | undefined)[] {
  return elements(
    page.main,
    (element) => element.tagName === "input" && attribute(element, "id") === id,
  ).map((field) => attribute(field, "value"));
}

/** Nothing stands beside a running write's control: no block, no region. */
function assertNothingInserted(page: DrawnPage, where: string): void {
  for (const inserted of ["fo-pending", "fo-pending-shape", "fo-wait"])
    assert.equal(
      byClass(page.main, inserted).length,
      0,
      where + " " + inserted,
    );
}

test("a settings write holds only the pressed control busy and inserts nothing", () => {
  for (const viewport of viewports)
    for (const write of writes) {
      const where = write.running + " " + viewport;
      const resting = drawnPage(settings + write.resting, viewport);
      const running = drawnPage(settings + write.running, viewport);
      // The same controls in the same order: only the pressed one changed,
      // and it shows its working word.
      assert.deepEqual(
        actions(running),
        pressed(actions(resting), write.control, write.working),
        where,
      );
      assert.deepEqual(busyActions(running), [write.working], where);
      assert.deepEqual(busyActions(resting), [], where);
      // A busy control refuses the press through `busy` and keeps focus.
      const control = busyControl(running, where);
      assert.notEqual(attribute(control, "aria-disabled"), "true", where);
      assert.equal(attribute(control, "tabindex"), "0", where);
      // The control already says it on screen, so the operation is heard only.
      assert.deepEqual(
        pendingLabels(running),
        [[write.heard, "screen-reader-only"]],
        where,
      );
      assertNothingInserted(running, where);
      for (const [id, value] of write.fields)
        assert.deepEqual(fieldValues(running, id), [value], where + " " + id);
    }
});

/**
 * Each visibility write: its drawing, the working word of the control that
 * sends it, the other decision, which waits disabled, and what screen readers
 * hear, with the project's name.
 */
const visibilityWrites = [
  [
    "project/visibility",
    "Making public…",
    "Keep private",
    "Making " + sample.project + " public…",
  ],
  [
    "project/visibility/private",
    "Making private…",
    "Keep public",
    "Making " + sample.project + " private…",
  ],
] as const;

test("the visibility modal names each write on its pressed control alone", () => {
  for (const viewport of viewports)
    for (const [id, working, other, heard] of visibilityWrites) {
      const where = settings + id + " " + viewport;
      const running = drawnPage(settings + id, viewport);
      assert.deepEqual(busyActions(running), [working], where);
      const control = busyControl(running, where);
      assert.notEqual(attribute(control, "aria-disabled"), "true", where);
      // The other decision cannot be pressed while the write runs.
      const [modal] = byClass(running.main, "fo-settings-modal-layer");
      assert.ok(modal, where + " draws no modal");
      assert.deepEqual(
        controlStates(modal),
        [
          [working, false],
          [other, true],
        ],
        where,
      );
      assert.deepEqual(
        pendingLabels(running),
        [[heard, "screen-reader-only"]],
        where,
      );
      assertNothingInserted(running, where);
    }
});

/** The Automatic builds setting's own row, switch and line. */
function setting(page: DrawnPage): {
  row: string;
  switch: [string | undefined, string | undefined];
  parts: (string | undefined)[];
} {
  const [found] = byClass(page.main, "fo-setting");
  assert.ok(found, "no Automatic builds setting");
  const [row] = byClass(found, "toggle-layout");
  const [control] = elements(
    found,
    (element) => attribute(element, "data-testid") === "firna-switch",
  );
  return {
    row: label(row),
    switch: [
      attribute(control, "aria-checked"),
      attribute(control, "aria-disabled"),
    ],
    // The parts that a sighted reader sees, in order.
    parts: childElements(found)
      .map((part) => attribute(part, "class"))
      .filter((name) => !(name ?? "").split(/\s+/).includes("fo-sr-only")),
  };
}

test("the Automatic builds switch says Saving… in its own row and holds still", () => {
  for (const viewport of viewports) {
    const where = "product/settings/project/builds-saving " + viewport;
    const resting = drawnPage(settings + "project", viewport);
    const running = drawnPage(settings + "project/builds-saving", viewport);
    assert.deepEqual(
      setting(resting),
      {
        row: "Automatic builds",
        switch: ["true", undefined],
        parts: ["toggle-layout", "fo-copy"],
      },
      where,
    );
    // The switch shows the value asked for, disabled, and its row says the
    // working word beside its label; the setting inserts nothing else.
    assert.deepEqual(
      setting(running),
      {
        row: "Automatic buildsSaving…",
        switch: ["false", "true"],
        parts: ["toggle-layout", "fo-copy"],
      },
      where,
    );
    assert.deepEqual(
      pendingLabels(running),
      [["Saving automatic builds…", "screen-reader-only"]],
      where,
    );
    // The pane's own controls are those at rest: the switch writes alone.
    assert.deepEqual(actions(running), actions(resting), where);
    assert.deepEqual(busyActions(running), [], where);
    assertNothingInserted(running, where);
  }
});

test("the Project pane's Save keeps its two other writes live", () => {
  for (const viewport of viewports) {
    const where = "product/settings/project/loading " + viewport;
    const running = drawnPage(settings + "project/loading", viewport);
    // Each write keeps its own control while Save runs: Make public still asks
    // its question, and the Automatic builds switch still writes on its own.
    assert.deepEqual(busyActions(running), ["Saving…"], where);
    assert.deepEqual(
      links(running, "Make public").map(destination),
      ["product/settings/project/visibility"],
      where,
    );
    assert.deepEqual(
      setting(running),
      {
        row: "Automatic builds",
        switch: ["true", undefined],
        parts: ["toggle-layout", "fo-copy"],
      },
      where,
    );
  }
});
