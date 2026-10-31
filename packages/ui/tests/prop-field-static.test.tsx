import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PropFieldFrame } from "../src/prop-field/prop-field.js";

type FrameProps = ComponentProps<typeof PropFieldFrame>;

const ID = "sample-label";

/** A required field around the host's own text input. */
function frame(props: Partial<FrameProps> = {}): FrameProps {
  return {
    description: "",
    disabled: false,
    id: ID,
    input: <input defaultValue="Continue" id={ID} type="text" />,
    label: "label",
    optional: false,
    supplied: true,
    wording: { notSet: "Not set", optional: "Optional", set: "Set label" },
    ...props,
  };
}

test("a static field frames the host's control in the shell's markup", () => {
  assert.equal(
    renderToStaticMarkup(<PropFieldFrame {...frame()} />),
    '<div class="mbk-control-field mbk-reset">' +
      `<label class="mbk-control-label mbk-reset" for="${ID}">label</label>` +
      '<div class="mbk-control-value mbk-reset">' +
      `<input id="${ID}" type="text" value="Continue"/>` +
      `<small class="mbk-reset" hidden="" id="${ID}-help"></small>` +
      `<small class="mbk-control-error mbk-reset" hidden="" id="${ID}-error"></small>` +
      "</div></div>",
  );
});

test("the label column names the host's control, and the help or the error follows it", () => {
  const { rerender } = render(
    <PropFieldFrame {...frame({ description: "The button text." })} />,
  );
  const input = screen.getByLabelText("label");
  assert.equal(input.id, ID);
  assert.equal(screen.getByText("The button text.").hidden, false);
  rerender(
    <PropFieldFrame
      {...frame({
        description: "The button text.",
        error: "Enter a label.",
      })}
    />,
  );
  assert.equal(
    document.getElementById(`${ID}-help`)?.hasAttribute("hidden"),
    true,
  );
  const error = document.getElementById(`${ID}-error`);
  assert.equal(error?.textContent, "Enter a label.");
  assert.equal(error?.hasAttribute("hidden"), false);
});

test("an unset optional field says Optional, offers Set, and says Not set beside the host's control", () => {
  render(
    <PropFieldFrame
      {...frame({
        input: <input defaultValue="" id="sample-hint" type="text" />,
        id: "sample-hint",
        label: "hint",
        optional: true,
        supplied: false,
        wording: { notSet: "Not set", optional: "Optional", set: "Set hint" },
      })}
    />,
  );
  const set = screen.getByRole("checkbox", { name: "Set hint" });
  assert.equal((set as HTMLInputElement).checked, false);
  assert.equal(
    screen.getByText("Optional").getAttribute("aria-hidden"),
    "true",
  );
  assert.equal(
    screen.getByText("Not set").className,
    "mbk-control-unset mbk-reset",
  );
  assert.equal(screen.getByLabelText("hint Optional").id, "sample-hint");
});
