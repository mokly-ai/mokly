import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, RefCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ControlsPanel,
  SavedPropsPanel,
  type ControlsFocus,
} from "../src/controls-panel/controls-panel.js";

import { assertSameElement } from "./dom-assertions.js";

const WORDING = {
  edited: "Edited props",
  heading: "Edit props",
  reset: "Reset to Default",
  saved: "Saved props",
};

type PanelProps = ComponentProps<typeof ControlsPanel>;

/** The edit form of the saved props, with its fields and its reports. */
function form(props: Partial<PanelProps> = {}, reports: string[] = []) {
  return (
    <ControlsPanel
      dirty={false}
      onReset={() => reports.push("reset")}
      onRetry={() => reports.push("retry")}
      onStart={() => reports.push("start")}
      title="Default"
      wording={WORDING}
      {...props}
    >
      <input aria-label="label" />
    </ControlsPanel>
  );
}

/** A focus function that records each named element. */
function recorder(found: Map<ControlsFocus, HTMLElement>) {
  return (name: ControlsFocus): RefCallback<HTMLElement> =>
    (element) => {
      if (element) found.set(name, element);
    };
}

test("the saved props' form keeps the shell's markup", () => {
  assert.equal(
    renderToStaticMarkup(form()),
    '<section class="mbk-component-controls"><div class="mbk-controls-heading"><div><h3 tabindex="-1">Edit props</h3><p>Default · Saved props</p></div><button class="mbk-controls-reset" disabled="" type="button">Reset to Default</button></div><p class="mbk-controls-restored" role="status"></p><fieldset class="mbk-control-fieldset"><input aria-label="label"/></fieldset></section>',
  );
});

test("edits show the Edited props badge and enable Reset, which reports each press", () => {
  const reports: string[] = [];
  render(form({ dirty: true }, reports));
  const heading = screen.getByRole("heading", { name: "Edit props" });
  assert.equal(heading.nextElementSibling?.textContent, "Default Edited props");
  assert.equal(
    screen.getByText("Edited props").className,
    "mbk-controls-edited",
  );
  const reset = screen.getByRole("button", { name: "Reset to Default" });
  assert.equal(reset.hasAttribute("disabled"), false);
  fireEvent.click(reset);
  assert.deepEqual(reports, ["reset"]);
});

test("without edits Reset is disabled and reports nothing", () => {
  const reports: string[] = [];
  render(form({}, reports));
  const reset = screen.getByRole("button", { name: "Reset to Default" });
  assert.equal(reset.hasAttribute("disabled"), true);
  fireEvent.click(reset);
  assert.deepEqual(reports, []);
});

test("an alert names what failed, and a failed render offers its action", () => {
  const reports: string[] = [];
  const { rerender } = render(
    form({ alert: { text: "These values are not valid together." } }, reports),
  );
  assert.equal(
    screen.getByRole("alert").outerHTML,
    '<p class="mbk-control-alert" role="alert">These values are not valid together.</p>',
  );
  rerender(
    form(
      {
        alert: {
          action: "Update preview",
          body: "Your edits are kept. The preview shows the saved props.",
          title: "The preview of your edits expired",
        },
      },
      reports,
    ),
  );
  const alert = screen.getByRole("alert");
  assert.equal(
    within(alert).getByText("The preview of your edits expired").tagName,
    "STRONG",
  );
  fireEvent.click(
    within(alert).getByRole("button", { name: "Update preview" }),
  );
  assert.deepEqual(reports, ["retry"]);
});

test("a reset announces itself in the status that the form always holds", () => {
  const { rerender } = render(form());
  const status = screen.getByRole("status");
  assert.equal(status.textContent, "");
  rerender(form({ restored: "Saved props restored." }));
  assertSameElement(screen.getByRole("status"), status);
  assert.equal(status.textContent, "Saved props restored.");
});

test("the fields wait while editing starts, and a failed start offers its action", () => {
  const reports: string[] = [];
  const { container, rerender } = render(
    form(
      { start: { status: "preparing", text: "Preparing to edit props…" } },
      reports,
    ),
  );
  const fieldset = container.querySelector("fieldset");
  assert.equal(fieldset?.disabled, true);
  const notice = screen.getByText("Preparing to edit props…");
  assert.equal(notice.getAttribute("role"), "status");
  assert.equal(notice.getAttribute("tabindex"), "-1");
  rerender(
    form(
      {
        start: {
          action: "Try again",
          status: "failed",
          text: "Editing could not start.",
        },
      },
      reports,
    ),
  );
  assert.equal(fieldset?.disabled, true);
  assertSameElement(screen.queryByText("Preparing to edit props…"), null);
  const alert = screen.getByRole("alert");
  assert.equal(alert.textContent, "Editing could not start. Try again");
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  assert.deepEqual(reports, ["start"]);
  rerender(form({}, reports));
  assert.equal(fieldset?.disabled, false);
});

test("the form names its heading, its fields, and its start notice for the host's focus", () => {
  const found = new Map<ControlsFocus, HTMLElement>();
  render(
    form({
      focus: recorder(found),
      start: { status: "preparing", text: "Preparing to edit props…" },
    }),
  );
  assert.deepEqual([...found.keys()].sort(), ["fields", "heading", "notice"]);
  assert.equal(found.get("heading")?.tagName, "H3");
  assert.equal(found.get("fields")?.tagName, "FIELDSET");
  assert.equal(found.get("notice")?.textContent, "Preparing to edit props…");
});

test("content without a control follows the fields", () => {
  const { container } = render(form({ extra: <p>Uncontrolled props</p> }));
  assert.equal(
    container.querySelector("fieldset")?.nextElementSibling?.textContent,
    "Uncontrolled props",
  );
});

test("saved props that cannot be edited name the reason, and a comparison offers Switch to Current", () => {
  const found = new Map<ControlsFocus, HTMLElement>();
  let presses = 0;
  const panel = (current?: string) => (
    <SavedPropsPanel
      current={current}
      focus={recorder(found)}
      heading="Saved props"
      notice="Comparisons show the saved props."
      onCurrent={() => (presses += 1)}
      title="Default"
    >
      <dl aria-label="Supplied props" />
    </SavedPropsPanel>
  );
  assert.equal(
    renderToStaticMarkup(panel("Switch to Current")),
    '<section class="mbk-component-controls"><div class="mbk-controls-heading"><div><h3 tabindex="-1">Saved props</h3><p>Default</p></div></div><p class="mbk-controls-notice">Comparisons show the saved props.</p><button class="mbk-text-button" type="button">Switch to Current</button><dl aria-label="Supplied props"></dl></section>',
  );
  const { rerender } = render(panel("Switch to Current"));
  fireEvent.click(screen.getByRole("button", { name: "Switch to Current" }));
  assert.equal(presses, 1);
  assert.deepEqual([...found.keys()], ["heading"]);
  rerender(panel());
  assertSameElement(screen.queryByRole("button"), null);
});
