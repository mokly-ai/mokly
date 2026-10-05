import assert from "node:assert/strict";
import test from "node:test";

import { validateComponentReviewSources } from "../dist/review/component_result_sources.js";

import { classifyFixtureWithSources } from "./helpers/component_fast_path.js";
import { cssMembershipFixture } from "./helpers/css_membership_fixture.js";

test("source proof rejects a component-only rule forged into a page reason on a retained path", async (t) => {
  const { input } = await cssMembershipFixture(t, {
    before: ".action{color:red}.heading{color:red}",
    after: ".action{color:blue}.heading{color:blue}",
  });
  const classified = await classifyFixtureWithSources(input);
  const result = structuredClone(classified.result);
  const screen = result.screens[0]!;
  const change = result.changes.find(
    (entry) => entry.after?.path === "checkout",
  )!;
  Object.assign(change, { reasons: screen.views[0]!.reasons });
  assert.throws(
    () =>
      validateComponentReviewSources(
        result,
        input.before,
        input.after,
        classified.implementationImpact,
        classified.sources,
      ),
    /source evidence|eligible rule/,
  );
});

test("source proof rejects component ids that have no kept own-page match", async (t) => {
  const { input } = await cssMembershipFixture(t, {
    before: ".action{color:red}",
    after: ".action{color:blue}",
  });
  const classified = await classifyFixtureWithSources(input);
  const result = structuredClone(classified.result);
  Object.assign(result.screens[0]!.views[0]!.reasons![0]!.analysis!.rules[0]!, {
    changedComponentPaths: ["toolbar"],
  });
  assert.throws(
    () =>
      validateComponentReviewSources(
        result,
        input.before,
        input.after,
        classified.implementationImpact,
        classified.sources,
      ),
    /own-page|component proof/,
  );
});

test("CSS source validation requires frozen catalogue proof", async (t) => {
  const { input } = await cssMembershipFixture(t, {
    before: ".action{color:red}",
    after: ".action{color:blue}",
  });
  const classified = await classifyFixtureWithSources(input);
  assert.throws(
    () =>
      validateComponentReviewSources(
        classified.result,
        input.before,
        input.after,
        classified.implementationImpact,
        {
          pathsByEntry: classified.sources.pathsByEntry,
          reasonsByEntry: classified.sources.reasonsByEntry!,
        },
      ),
    /CSS.*proof/,
  );
});
