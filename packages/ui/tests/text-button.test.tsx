import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { TextButton } from "../src/text-button/text-button.js";

test("a text button is a plain button with the shell's attribute order", () => {
  assert.equal(
    renderToStaticMarkup(<TextButton>Try again</TextButton>),
    '<button class="mbk-text-button mbk-reset" type="button">Try again</button>',
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

test("a text button with an address is a link with the button's look, which reports no press", () => {
  assert.equal(
    renderToStaticMarkup(<TextButton href="../pending/">Try again</TextButton>),
    '<a class="mbk-text-button mbk-reset" href="../pending/">Try again</a>',
  );
  const presses: unknown[] = [];
  render(
    <TextButton href="#pending" onClick={() => presses.push("press")}>
      Try again
    </TextButton>,
  );
  fireEvent.click(screen.getByRole("link", { name: "Try again" }));
  assert.deepEqual(presses, []);
  assert.deepEqual(
    screen.queryAllByRole("button").map((element) => element.textContent),
    [],
  );
});
