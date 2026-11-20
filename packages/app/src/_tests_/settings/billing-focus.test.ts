import assert from "node:assert/strict";
import { test } from "node:test";

import { act } from "react";

import { billingPane, checkoutUrl } from "./billing-focus-harness";

test("returning to Billing after Checkout reads until Team and refreshes workspace and project reads", async (t) => {
  const pane = await billingPane(t);
  await pane.mount();
  assert.deepEqual(pane.reads, ["free"]);
  assert.deepEqual(pane.versions(), [0, 0]);

  await act(async () => pane.control("upgrade-to-team").click());
  assert.deepEqual(pane.writes, ["checkout"]);
  assert.deepEqual(pane.opened, [
    [checkoutUrl, "_blank", "noopener,noreferrer"],
  ]);

  await pane.focus();
  assert.deepEqual(pane.reads, ["free", "free"], "focus reads billing again");
  assert.deepEqual(pane.versions(), [0, 0]);

  await pane.tick(2_000);
  assert.deepEqual(
    pane.reads,
    ["free", "free", "team"],
    "Checkout keeps reading after the first Free answer",
  );
  assert.equal(pane.control("manage-billing").textContent, "Manage billing");
  assert.deepEqual(
    pane.versions(),
    [1, 1],
    "the Team read invalidates workspace and project reads",
  );
});
