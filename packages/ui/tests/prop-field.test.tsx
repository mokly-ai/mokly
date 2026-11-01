import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PropField, PropFields } from "../src/prop-field/prop-field.js";

import { assertSameElement } from "./dom-assertions.js";

type FieldProps = ComponentProps<typeof PropField>;

/** A required text field without help, and the reports of its callbacks. */
function field(
  props: Partial<FieldProps> = {},
  reports: unknown[][] = [],
): FieldProps {
  return {
    control: { kind: "text" },
    description: "",
    disabled: false,
    id: "root-mb-prop-action-label",
    label: "label",
    name: "label",
    onChange: (value, immediate) => reports.push(["change", value, immediate]),
    onSupply: (supplied) => reports.push(["supply", supplied]),
    optional: false,
    supplied: true,
    value: "Go",
    wording: { notSet: "Not set", optional: "Optional", set: "Set label" },
    ...props,
  };
}

const ID = "root-mb-prop-action-label";

test("a field keeps the shell's markup: the label column, then the value, help, and error", () => {
  assert.equal(
    renderToStaticMarkup(
      <PropFields>
        <PropField {...field({ description: "The button text." })} />
      </PropFields>,
    ),
    '<div class="mbk-control-rows mbk-reset"><div class="mbk-control-field mbk-reset">' +
      `<label class="mbk-control-label mbk-reset" for="${ID}">label</label>` +
      '<div class="mbk-control-value mbk-reset">' +
      `<input aria-describedby="${ID}-help" data-prop-control="label" id="${ID}" type="text" class="mbk-reset" value="Go"/>` +
      `<small class="mbk-reset" id="${ID}-help">The button text.</small>` +
      `<small class="mbk-control-error mbk-reset" hidden="" id="${ID}-error"></small>` +
      "</div></div></div>",
  );
});

test("a text field is named by its label, described by its help, and reports typed values", () => {
  const reports: unknown[][] = [];
  render(
    <PropField {...field({ description: "The button text." }, reports)} />,
  );
  const input = screen.getByLabelText("label");
  assert.equal(input.getAttribute("type"), "text");
  assert.equal(input.getAttribute("aria-describedby"), `${ID}-help`);
  assert.equal(input.hasAttribute("aria-invalid"), false);
  assert.equal(screen.getByText("The button text.").hidden, false);
  fireEvent.change(input, { target: { value: "Go on" } });
  assert.deepEqual(reports, [["change", "Go on", false]]);
});

test("a field without help names no description", () => {
  render(<PropField {...field()} />);
  const input = screen.getByLabelText("label");
  assert.equal(input.hasAttribute("aria-describedby"), false);
  assert.equal(document.getElementById(`${ID}-help`)?.hidden, true);
});

test("an error replaces the help, describes the control, and marks it invalid", () => {
  render(
    <PropField
      {...field({
        description: "The button text.",
        error: "Enter up to 3 characters.",
      })}
    />,
  );
  const input = screen.getByLabelText("label");
  assert.equal(input.getAttribute("aria-describedby"), `${ID}-error`);
  assert.equal(input.getAttribute("aria-invalid"), "true");
  const error = document.getElementById(`${ID}-error`);
  assert.equal(error?.textContent, "Enter up to 3 characters.");
  assert.equal(error?.hidden, false);
  assert.equal(document.getElementById(`${ID}-help`)?.hidden, true);
});

test("a number field carries its HTML bounds and decimal input mode", () => {
  const reports: unknown[][] = [];
  render(
    <PropField
      {...field(
        {
          control: { kind: "number", max: 9, min: -3, step: 3 },
          label: "count",
          name: "count",
          value: "3",
        },
        reports,
      )}
    />,
  );
  const input = screen.getByLabelText("count");
  assert.deepEqual(
    ["type", "inputmode", "min", "max", "step", "data-prop-control"].map(
      (name) => input.getAttribute(name),
    ),
    ["number", "decimal", "-3", "9", "3", "count"],
  );
  fireEvent.change(input, { target: { value: "6" } });
  assert.deepEqual(reports, [["change", "6", false]]);
  assert.match(
    renderToStaticMarkup(
      <PropField {...field({ control: { kind: "number", step: "any" } })} />,
    ),
    /<input data-prop-control="label" id="[^"]+" inputMode="decimal" step="any" type="number" class="mbk-reset" value="Go"\/>/,
  );
});

test("a select offers the empty choice first and reports each choice at once", () => {
  const reports: unknown[][] = [];
  render(
    <PropField
      {...field(
        {
          control: {
            kind: "select",
            options: ["Warm", "Cool"],
            placeholder: "Choose a value",
          },
          label: "tone",
          name: "tone",
          value: "1",
        },
        reports,
      )}
    />,
  );
  const select = screen.getByRole("combobox", { name: "tone" });
  assert.ok(select instanceof HTMLSelectElement);
  assert.equal(select.value, "1");
  assert.deepEqual(
    [...select.options].map((option) => [option.value, option.textContent]),
    [
      ["", "Choose a value"],
      ["0", "Warm"],
      ["1", "Cool"],
    ],
  );
  fireEvent.change(select, { target: { value: "0" } });
  assert.deepEqual(reports, [["change", "0", true]]);
});

test("a required toggle is named by its label column and reports each change at once", () => {
  const reports: unknown[][] = [];
  render(
    <PropField
      {...field(
        {
          control: { kind: "boolean" },
          label: "Muted",
          name: "muted",
          value: false,
        },
        reports,
      )}
    />,
  );
  const box = screen.getByRole("checkbox", { name: "Muted" });
  assert.equal(box.id, ID);
  fireEvent.click(box);
  assert.deepEqual(reports, [["change", true, true]]);
  assertSameElement(screen.queryByText("Optional"), null);
});

test("an optional toggle names its value check box and supplies itself with Set", () => {
  const reports: unknown[][] = [];
  const props = field(
    {
      control: { kind: "boolean" },
      label: "Muted",
      name: "muted",
      optional: true,
      value: true,
      wording: { notSet: "Not set", optional: "Optional", set: "Set Muted" },
    },
    reports,
  );
  const { container, rerender } = render(<PropField {...props} />);
  // The label column is no label, so the value check box carries the name.
  assertSameElement(container.querySelector("label[for]"), null);
  assert.equal(
    container.querySelector(".mbk-control-label")?.textContent,
    "Muted Optional",
  );
  const value = screen.getByRole("checkbox", { name: "Muted" });
  assert.equal(value.getAttribute("data-prop-control"), "muted");
  const set = screen.getByRole("checkbox", { name: "Set Muted" });
  assert.equal((set as HTMLInputElement).checked, true);
  assertSameElement(screen.queryByText("Not set"), null);

  rerender(<PropField {...props} supplied={false} />);
  assert.equal(
    screen.getByText("Not set").className,
    "mbk-control-unset mbk-reset",
  );
  assert.equal(value.closest("label")?.hidden, true);
  assert.equal(value.hidden, true);
  fireEvent.click(set);
  assert.deepEqual(reports, [["supply", true]]);
});

test("an optional text field says Optional and Not set, and hides its control until supplied", () => {
  const reports: unknown[][] = [];
  render(
    <PropField
      {...field({ optional: true, supplied: false, value: "" }, reports)}
    />,
  );
  const label = document.querySelector(`label[for="${ID}"]`);
  assert.equal(label?.textContent, "label Optional");
  assert.equal(
    label?.querySelector(".mbk-control-optional")?.getAttribute("aria-hidden"),
    "true",
  );
  assert.equal(document.getElementById(ID)?.hidden, true);
  assert.ok(screen.getByText("Not set"));
  fireEvent.click(screen.getByRole("checkbox", { name: "Set label" }));
  assert.deepEqual(reports, [["supply", true]]);
});

test("a disabled field disables its control and its Set check box", () => {
  render(<PropField {...field({ disabled: true, optional: true })} />);
  assert.equal(
    screen
      .getByRole("checkbox", { name: "Set label" })
      .hasAttribute("disabled"),
    true,
  );
  assert.equal(document.getElementById(ID)?.hasAttribute("disabled"), true);
});
