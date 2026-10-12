import assert from "node:assert/strict";
import test from "node:test";

import {
  CssAttribution,
  type CollectedCssRule,
} from "../dist/review/css/attribution.js";

import { classifyFixtureWithSources } from "./helpers/component_fast_path.js";
import { cssMembershipFixture } from "./helpers/css_membership_fixture.js";
import { fingerprintProofProjection } from "./helpers/fingerprint_proof_projection.mjs";

type Classification = Awaited<ReturnType<typeof classifyFixtureWithSources>>;
type Proof = {
  records: WeakMap<object, readonly CollectedCssRule[]>;
  all: CollectedCssRule[];
  unfiltered: Map<string, Set<string>>;
  changed: Map<string, Set<string>>;
  frozen: boolean;
};
const proofOf = (value: Classification) =>
  value.sources.cssProof as unknown as Proof;

function withRules(value: Classification, all: CollectedCssRule[]) {
  const proof = value.sources.cssProof!;
  return {
    ...value,
    sources: Object.assign(
      Object.create(Object.getPrototypeOf(value.sources)),
      value.sources,
      {
        cssProof: Object.assign(Object.create(Object.getPrototypeOf(proof)), {
          ...proof,
          all,
        }) as CssAttribution,
      },
    ),
  };
}

test("replay projection compares a real CSS membership classification", async (t) => {
  const captured = new Map<CssAttribution, (readonly CollectedCssRule[])[]>();
  const record = CssAttribution.prototype.record;
  t.mock.method(
    CssAttribution.prototype,
    "record",
    function (this: CssAttribution, rules: readonly CollectedCssRule[]) {
      const analysis = record.call(this, rules);
      const proof = this as unknown as Proof;
      assert.equal(proof.records.get(analysis), rules);
      assert.deepEqual(proof.all.slice(-rules.length), rules);
      captured.set(this, [...(captured.get(this) ?? []), rules]);
      return analysis;
    },
  );
  const fixture = await cssMembershipFixture(t, {
    before: ".action { color: red; }",
    after: ".action { color: blue; }",
  });
  const left = await classifyFixtureWithSources(fixture.input);
  const right = await classifyFixtureWithSources(fixture.input);
  const proof = proofOf(left);
  assert.ok(proof.all.length > 1);
  assert.ok(left.result.components.some((entry) => entry.state === "changed"));
  const lists = captured.get(left.sources.cssProof!)!;
  assert.ok(lists.length > 0);
  assert.equal(lists.flat().length, proof.all.length);
  for (const rule of lists.flat()) assert.ok(proof.all.includes(rule));
  t.diagnostic(
    `${lists.length} recorded lists; all ${proof.all.length} rules remain in all`,
  );

  await t.test("two runs of the same input compare equal", () => {
    assert.notEqual(proof.records, proofOf(right).records);
    assert.deepEqual(
      fingerprintProofProjection(left),
      fingerprintProofProjection(right),
    );
  });

  await t.test(
    "different record order compares equal without changing the source",
    () => {
      const reversed = withRules(left, [...proof.all].reverse());
      const order = [...proofOf(reversed).all];
      assert.deepEqual(
        fingerprintProofProjection(left),
        fingerprintProofProjection(reversed),
      );
      assert.deepEqual(proofOf(reversed).all, order);
    },
  );

  await t.test("a changed record differs from the saved projection", () => {
    const changed = withRules(left, [...proof.all]);
    const before = fingerprintProofProjection(changed);
    proofOf(changed).all[0] = {
      ...proof.all[0]!,
      selectors: [".different"],
    };
    assert.notDeepEqual(before, fingerprintProofProjection(changed));
    assert.notDeepEqual(
      fingerprintProofProjection(left),
      fingerprintProofProjection(changed),
    );
  });

  await t.test("a missing record compares unequal", () => {
    assert.notDeepEqual(
      fingerprintProofProjection(left),
      fingerprintProofProjection(withRules(left, proof.all.slice(1))),
    );
  });

  await t.test("CSS rule evidence with empty all fails", () => {
    assert.throws(
      () => fingerprintProofProjection(withRules(left, [])),
      /CSS rule evidence.*empty/,
    );
  });

  await t.test(
    "only records is dropped and every other proof field stays",
    () => {
      const projected = fingerprintProofProjection(left) as {
        sources: { cssProof: Omit<Proof, "records"> };
      };
      assert.equal(Object.hasOwn(projected.sources.cssProof, "records"), false);
      assert.deepEqual(Object.keys(projected.sources.cssProof).sort(), [
        "all",
        "changed",
        "frozen",
        "unfiltered",
      ]);
      for (const field of ["unfiltered", "changed", "frozen"] as const)
        assert.deepEqual(projected.sources.cssProof[field], proof[field]);
      assert.notEqual(projected.sources.cssProof.all, proof.all);
      assert.ok(proof.records instanceof WeakMap);
    },
  );
});

test("replay projection keeps errors and results without CSS proof unchanged", () => {
  for (const value of [
    { name: "Error", message: "failure" },
    { result: {}, sources: {} },
  ])
    assert.equal(fingerprintProofProjection(value), value);
});
