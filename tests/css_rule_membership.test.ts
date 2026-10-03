import assert from "node:assert/strict";
import test from "node:test";

import {
  cssMembershipFixture,
  changedIds,
} from "./helpers/css_membership_fixture.js";

for (const delivery of [
  "configured",
  "declared",
  "imported",
  "javascript",
] as const) {
  test(`${delivery}: a stylesheet absent from component own pages cannot grant a component reason`, async (t) => {
    const { result } = await cssMembershipFixture(t, {
      delivery,
      screenStylesOnly: true,
      separateRoots: delivery === "javascript",
      before: ".action{color:red}",
      after: ".action{color:blue}",
    });
    assert.deepEqual(changedIds(result), ["checkout"]);
    assert.deepEqual(result.affectedConsumers, []);
    assert.deepEqual(
      result.screens[0]!.views[0]!.reasons![0]!.analysis!.rules[0]!
        .changedComponentIds,
      [],
    );
  });
  test(`${delivery}: component-only CSS uses own-page matches and nested filtering`, async (t) => {
    const { result } = await cssMembershipFixture(t, {
      delivery,
      before: ".action { color:red }",
      after: ".action { color:blue }",
    });
    assert.deepEqual(changedIds(result), ["action", "action-default"]);
    const screen = result.screens[0]!;
    assert.equal(screen.views[0]!.state, "changed");
    assert.equal(screen.views[0]!.material, undefined);
    const analysis = screen.views[0]!.reasons![0]!.analysis!;
    assert.deepEqual(analysis.rules[0]!.changedComponentIds, ["action"]);
    assert.equal(analysis.pageEvidence, undefined);
    assert.match(analysis.rules[0]!.ruleKey!, /^[a-f0-9]{64}$/);
    assert.ok(
      result.affectedConsumers.some(
        (consumer) => consumer.changedComponentId === "action",
      ),
    );
  });
  for (const [name, selector] of [
    ["outside", ".heading"],
    ["screen-only inside", ".checkout .action"],
    ["unresolved", ":root"],
  ] as const)
    test(`${delivery}: ${name} CSS keeps a page row without changing a component`, async (t) => {
      const { result } = await cssMembershipFixture(t, {
        delivery,
        before: `${selector}{color:red}`,
        after: `${selector}{color:blue}`,
      });
      assert.deepEqual(
        changedIds(result),
        name === "unresolved"
          ? ["action-default", "checkout", "toolbar-default"]
          : ["checkout"],
      );
      assert.deepEqual(result.affectedConsumers, []);
      const analysis = result.screens[0]!.views[0]!.reasons![0]!.analysis!;
      assert.deepEqual(analysis.rules[0]!.changedComponentIds, []);
      assert.deepEqual(
        analysis.pageEvidence,
        name === "unresolved"
          ? { selectors: [], unresolved: true }
          : { selectors: [selector] },
      );
    });
}

test("a contextual nested rule changes Toolbar when Action has no own-page match", async (t) => {
  const { result } = await cssMembershipFixture(t, {
    before: ".toolbar .action{color:red}",
    after: ".toolbar .action{color:blue}",
  });
  assert.deepEqual(changedIds(result), ["toolbar", "toolbar-default"]);
  assert.deepEqual(
    result.screens[0]!.views[0]!.reasons![0]!.analysis!.rules[0]!
      .changedComponentIds,
    ["toolbar"],
  );
});
