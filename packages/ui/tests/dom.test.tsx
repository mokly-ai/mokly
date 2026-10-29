import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";

function Counter({ onPress }: { onPress: () => void }) {
  return (
    <button type="button" onClick={onPress}>
      Count
    </button>
  );
}

test("a component renders, answers a role query, and reports each click", () => {
  let presses = 0;
  render(
    <Counter
      onPress={() => {
        presses += 1;
      }}
    />,
  );
  const button = screen.getByRole("button", { name: "Count" });
  fireEvent.click(button);
  fireEvent.click(button);
  assert.equal(presses, 2);
});

test("each test starts from an empty document", () => {
  assert.equal(document.body.childElementCount, 0);
  render(<Counter onPress={() => undefined} />);
  assert.equal(screen.getAllByRole("button").length, 1);
});

test("a second evaluation of the DOM helper keeps the one window", async () => {
  const window = globalThis.window;
  await import(new URL("./dom.ts?again", import.meta.url).href);
  assert.equal(globalThis.window, window);
  render(<Counter onPress={() => undefined} />);
  assert.equal(screen.getAllByRole("button").length, 1);
});
