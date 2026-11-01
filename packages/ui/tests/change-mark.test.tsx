import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";

import { ChangeMark } from "../src/change-mark/change-mark.js";

function MarkedControl({ marked }: { marked: boolean }) {
  return (
    <button
      aria-describedby={marked ? "viewport-changed" : undefined}
      type="button"
    >
      Viewport
      <ChangeMark
        id="viewport-changed"
        kind="viewport"
        marked={marked}
        text="Other viewport changed"
      />
    </button>
  );
}

test("an unmarked control renders the mark hidden, ready to show", () => {
  const { container } = render(<MarkedControl marked={false} />);
  const dot = container.querySelector(".mbk-view-changed");
  const wording = container.querySelector(".mbk-view-changed-text");
  assert.ok(dot && wording);
  assert.equal(dot.getAttribute("aria-hidden"), "true");
  assert.equal(dot.getAttribute("data-view-changed"), "viewport");
  assert.equal(wording.getAttribute("data-view-changed-text"), "viewport");
  assert.equal(wording.id, "viewport-changed");
  assert.equal(wording.textContent, "Other viewport changed");
  assert.equal(dot.hasAttribute("hidden"), true);
  assert.equal(wording.hasAttribute("hidden"), true);
  assert.equal(dot.textContent, "");
});

test("a marked control shows the dot and is described by the wording", () => {
  const { container } = render(<MarkedControl marked />);
  assert.equal(
    container.querySelector(".mbk-view-changed")?.hasAttribute("hidden"),
    false,
  );
  assert.ok(
    screen.getByRole("button", { description: "Other viewport changed" }),
  );
});

test("a scheme mark names its axis", () => {
  const { container } = render(
    <ChangeMark
      id="scheme-changed"
      kind="scheme"
      marked
      text="Other theme changed"
    />,
  );
  assert.deepEqual(
    [...container.children].map((span) => [
      span.className,
      span.getAttribute("data-view-changed") ??
        span.getAttribute("data-view-changed-text"),
    ]),
    [
      ["mbk-view-changed mbk-reset", "scheme"],
      ["mbk-view-changed-text mbk-reset", "scheme"],
    ],
  );
});
