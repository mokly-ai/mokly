import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { TextButton } from "../src/text-button/text-button.js";

test("a text button is a plain button with the shell's attribute order", () => {
  assert.equal(
    renderToStaticMarkup(<TextButton>Try again</TextButton>),
    '<button class="mbk-text-button" type="button">Try again</button>',
  );
});

test("each press reaches the callback without the click event", () => {
  const presses: unknown[][] = [];
  render(
    <TextButton onClick={(...args: unknown[]) => presses.push(args)}>
      Switch to Current
    </TextButton>,
  );
  const button = screen.getByRole("button", { name: "Switch to Current" });
  fireEvent.click(button);
  fireEvent.click(button);
  assert.deepEqual(presses, [[], []]);
});

test("a text button without a callback stays a button that a press leaves alone", () => {
  render(<TextButton>Try again</TextButton>);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  assert.ok(screen.getByRole("button", { name: "Try again" }));
});
