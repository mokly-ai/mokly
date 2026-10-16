import assert from "node:assert/strict";
import test from "node:test";

import { childEnvironment } from "../scripts/verification/child-environment.mjs";

test("children cannot inherit the caller's Git index or org token", () => {
  const input = {
    BLACKSMITH_ORG_TOKEN: "fixture-only",
    GIT_DIR: "/other",
    GIT_INDEX_FILE: "/other/index",
    GIT_CONFIG_PARAMETERS: "fixture",
    PATH: "/tools",
    MOKLY_VERIFICATION_OWNER_ID: "owner",
  };
  assert.deepEqual(childEnvironment(input), {
    PATH: "/tools",
    MOKLY_VERIFICATION_OWNER_ID: "owner",
  });
  assert.equal(input.GIT_INDEX_FILE, "/other/index");
});
