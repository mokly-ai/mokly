import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { EditStatus } from "../src/edit-status/edit-status.js";

import { assertSameElement } from "./dom-assertions.js";

test("the edit status stays present, and a render in flight shows its dot and text", () => {
  assert.equal(
    renderToStaticMarkup(<EditStatus />),
    '<p class="mbk-edit-status" role="status"></p>',
  );
  assert.equal(
    renderToStaticMarkup(<EditStatus status="Updating preview…" />),
    '<p class="mbk-edit-status" role="status"><span aria-hidden="true" class="mbk-pending-dot"></span>Updating preview…</p>',
  );
});

test("the status region keeps its element when a render starts and ends", () => {
  const { rerender } = render(<EditStatus />);
  const status = screen.getByRole("status");
  assert.equal(status.textContent, "");
  rerender(<EditStatus status="Updating preview…" />);
  assertSameElement(screen.getByRole("status"), status);
  assert.equal(status.textContent, "Updating preview…");
  assert.equal(
    status.querySelector(".mbk-pending-dot")?.getAttribute("aria-hidden"),
    "true",
  );
  rerender(<EditStatus />);
  assertSameElement(screen.getByRole("status"), status);
  assert.equal(status.textContent, "");
});
