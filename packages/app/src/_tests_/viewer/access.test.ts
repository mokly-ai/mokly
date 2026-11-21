import assert from "node:assert/strict";
import { test } from "node:test";

import { currentAccessState, type ScopedAccess } from "../../viewer/access";

test("access readiness belongs only to the current source identity", () => {
  const previous: ScopedAccess = {
    key: "project-a:publication-a:true:true:0",
    state: { status: "granted" },
  };
  assert.deepEqual(
    currentAccessState("project-a:publication-b:true:true:0", previous),
    { status: "granting" },
  );
  assert.deepEqual(currentAccessState(previous.key, previous), {
    status: "granted",
  });
});
