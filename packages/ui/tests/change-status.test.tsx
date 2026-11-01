import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ChangeStatus,
  type ChangeStatusValue,
} from "../src/change-status/change-status.js";

import { assertSameElement } from "./dom-assertions.js";

const STATUSES: readonly ChangeStatusValue[] = [
  "Added",
  "Changed",
  "Removed",
  "Unmodified",
];

test("each status keeps the badge markup that the shell's tests read", () => {
  for (const status of STATUSES)
    assert.equal(
      renderToStaticMarkup(<ChangeStatus status={status} />),
      `<span class="mbk-entry-status mbk-reset" data-status="${status}">${status}</span>`,
    );
  assert.equal(
    renderToStaticMarkup(
      <ChangeStatus mark="data-workspace-status" status="Changed" />,
    ),
    '<span class="mbk-entry-status mbk-reset" data-status="Changed" data-workspace-status="">Changed</span>',
  );
});

test("each status shows its word and carries it for the stylesheet", () => {
  for (const status of STATUSES) {
    const { unmount } = render(<ChangeStatus status={status} />);
    const badge = screen.getByText(status);
    assert.equal(badge.className, "mbk-entry-status mbk-reset");
    assert.equal(badge.getAttribute("data-status"), status);
    assert.equal(badge.hidden, false);
    unmount();
  }
});

test("a badge without a status stays in place, hidden and empty", () => {
  assert.equal(
    renderToStaticMarkup(<ChangeStatus mark="data-workspace-status" />),
    '<span class="mbk-entry-status mbk-reset" data-workspace-status="" hidden=""></span>',
  );
  const { container, rerender } = render(
    <ChangeStatus mark="data-workspace-status" />,
  );
  const badge = container.querySelector("[data-workspace-status]");
  assert.ok(badge instanceof HTMLElement);
  assert.equal(badge.hidden, true);
  assert.equal(badge.textContent, "");
  assert.equal(badge.hasAttribute("data-status"), false);

  // A status that arrives later shows in the same badge.
  rerender(<ChangeStatus mark="data-workspace-status" status="Added" />);
  assertSameElement(container.querySelector("[data-workspace-status]"), badge);
  assert.equal(badge.hidden, false);
  assert.equal(badge.textContent, "Added");
  assert.equal(badge.getAttribute("data-status"), "Added");
});

test("a badge without a mark carries no data attribute but its status", () => {
  const { container } = render(<ChangeStatus status="Removed" />);
  const badge = container.firstElementChild;
  assert.ok(badge);
  assert.deepEqual(
    [...badge.attributes].map((attribute) => attribute.name),
    ["class", "data-status"],
  );
});
