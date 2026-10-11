import assert from "node:assert/strict";
import test from "node:test";

import { lintProbe, requireLintRule } from "./helpers/lint_config.js";

const teardownRule = "mokly/no-late-fixture-teardown";
const eagerRule = "mokly/no-eager-fixture-setup";
const teardownMessage =
  "Register dependent cleanup with fixture.beforeRemove(), not a later test hook.";
const eagerMessage = "Start shared setup through fileFixture on first use.";
const probes = [
  "tests/fixture-lint-probe.test.ts",
  "tests/browser/fixture-lint-probe.spec.tsx",
  "tests/helpers/nested/fixture-lint-probe.mts",
  "tests/fixture-lint-probe.test.cts",
  "tests/fixture-lint-probe.test.js",
  "tests/browser/fixture-lint-probe.mjs",
  "tests/helpers/fixture-lint-probe.cjs",
];
const eagerSample = `
const direct = designLibraryFixture({ after });
if (enabled) designLibraryFixture({ after });
const lazy = fileFixture((owner) => designLibraryFixture(owner));
async function testBody(t) { await designLibraryFixture(t); }
const nested = () => designLibraryFixture(owner);
class Fixture { async setup(t) { return designLibraryFixture(t); } }
class Other { constructor(t) { designLibraryFixture(t); } get value() { return designLibraryFixture(owner); } }
`;
const lateSample = `test("late", async (t) => {
  const fixture = await designLibraryFixture(t);
  t.after(() => fixture.close());
});
const shared = changedFixture();
test.after(() => shared.remove());
test("review", async (t) => {
  const review = await componentReviewFixture(t);
  t?.after(() => review.close());
});
test("chained", () => changedFixture(owner).after(() => undefined));
`;
const acceptedSample = `test("early", async (t) => {
  t.after(() => cleanup());
  const fixture = await changedFixture(t);
  fixture.beforeRemove(() => fixture.close());
});
test("nested", async (t) => {
  const fixture = await designLibraryFixture(t);
  const register = () => t.after(() => fixture.close());
  register();
});
test("outer", async (t) => {
  const setup = () => designLibraryFixture(t);
  t.after(() => cleanup());
  await setup();
});
const expression = function () { return designLibraryFixture(owner); };
const object = { setup(t) { return designLibraryFixture(t); }, set value(t) { designLibraryFixture(t); } };
class Accessors { set value(t) { designLibraryFixture(t); } static create() { return designLibraryFixture(owner); } }
`;

async function fixtureMessages(source: string, filePath: string) {
  const result = await lintProbe(source, filePath);
  return result.messages
    .filter(({ ruleId }) => ruleId === teardownRule || ruleId === eagerRule)
    .map(({ ruleId, line, message, severity }) => ({
      ruleId,
      line,
      message,
      severity,
    }));
}

for (const filePath of probes) {
  test(`module-scope design fixture calls are rejected in ${filePath}`, async () => {
    await requireLintRule(filePath, eagerRule);
    assert.deepEqual(await fixtureMessages(eagerSample, filePath), [
      { ruleId: eagerRule, line: 2, message: eagerMessage, severity: 2 },
      { ruleId: eagerRule, line: 3, message: eagerMessage, severity: 2 },
    ]);
  });

  test(`teardown hooks after a fixture call are rejected in ${filePath}`, async () => {
    await requireLintRule(filePath, teardownRule);
    assert.deepEqual(
      await fixtureMessages(lateSample, filePath),
      [3, 6, 9, 11].map((line) => ({
        ruleId: teardownRule,
        line,
        message: teardownMessage,
        severity: 2,
      })),
    );
  });

  test(`earlier hooks, nested scopes and lazy setup are accepted in ${filePath}`, async () => {
    assert.deepEqual(await fixtureMessages(acceptedSample, filePath), []);
  });
}
