import assert from "node:assert/strict";
import { test } from "node:test";

import { canManageBilling } from "../screens/product/settings/billing-plans";

test("only an owner can receive mockup billing actions", () => {
  assert.equal(canManageBilling("owner"), true);
  assert.equal(canManageBilling("admin"), false);
});
