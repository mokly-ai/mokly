import assert from "node:assert/strict";
import test from "node:test";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { comparePageFixture } from "./helpers/page_comparison.js";

test("captured M6 engine preserves delivered comparison materials and results", async (context) => {
  const fixture = await componentReviewFixture(context, (source) =>
    source.replace("Screen content", "Changed screen"),
  );
  const input = {
    ...fixture,
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: fixture.before.outputs,
    afterFiles: fixture.after.outputs,
  };
  assert.deepEqual(
    await comparePageFixture(input),
    await comparePageFixture(input, true),
  );
});
