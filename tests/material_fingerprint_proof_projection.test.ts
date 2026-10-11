import assert from "node:assert/strict";
import test from "node:test";

import { fingerprintProofProjection } from "./helpers/fingerprint_proof_projection.mjs";

type Rule = { ruleKey: string; selectors: string[]; matches: unknown[] };

class Proof {
  readonly records = new WeakMap<object, Rule[]>();
  readonly all: Rule[] = [];
  readonly frozen = true;
}

function fixture() {
  const proof = new Proof();
  const analyses = [0, 1, 2].map(() => ({ rules: [] }));
  const records = ["entry", "screen", "component"].map((ruleKey) => [
    { ruleKey, selectors: [`.${ruleKey}`], matches: [] },
  ]);
  analyses.forEach((analysis, index) =>
    proof.records.set(analysis, records[index]!),
  );
  const reason = (index: number) => ({
    kind: "dependency",
    path: "sheet.css",
    analysis: analyses[index]!,
  });
  const value = {
    result: {
      changes: [{ reasons: [reason(0)] }],
      screens: [{ views: [{ reasons: [reason(1)] }] }],
      components: [{ variants: [{ views: [{ reasons: [reason(2)] }] }] }],
    },
    sources: {
      cssProof: proof,
      pathsByEntry: new Map([["screen", new Set(["sheet.css"])]]),
    },
    implementationImpact: new Set(["action"]),
    pairing: { moves: [], diagnostics: [] },
  };
  return { value, proof, analyses, records };
}

test("replay projection compares equal records from distinct WeakMaps", () => {
  const left = fixture();
  const right = fixture();
  assert.notEqual(left.proof.records, right.proof.records);
  assert.deepEqual(
    fingerprintProofProjection(left.value),
    fingerprintProofProjection(right.value),
  );
});

test("replay projection detects different record content", () => {
  const left = fixture();
  const right = fixture();
  right.proof.records.set(right.analyses[2]!, [
    { ...right.records[2]![0]!, selectors: [".different"] },
  ]);
  assert.notDeepEqual(
    fingerprintProofProjection(left.value),
    fingerprintProofProjection(right.value),
  );
});

test("replay projection detects a missing record", () => {
  const left = fixture();
  const right = fixture();
  right.proof.records.delete(right.analyses[1]!);
  assert.notDeepEqual(
    fingerprintProofProjection(left.value),
    fingerprintProofProjection(right.value),
  );
});

test("replay projection keeps reason order, undefined records and all other fields", () => {
  const { value, proof, analyses, records } = fixture();
  proof.records.delete(analyses[1]!);
  const expected = {
    ...value,
    sources: {
      ...value.sources,
      cssProof: Object.assign(new Proof(), {
        records: [records[0], undefined, records[2]],
      }),
    },
  };
  assert.deepEqual(fingerprintProofProjection(value), expected);
  assert.ok(proof.records instanceof WeakMap);
  assert.equal(proof.records.get(analyses[0]!), records[0]);
  assert.equal(proof.records.get(analyses[1]!), undefined);
  assert.equal(proof.records.get(analyses[2]!), records[2]);
});

test("replay projection keeps errors and results without CSS proof unchanged", () => {
  for (const value of [
    { name: "Error", message: "failure" },
    { result: {}, sources: {} },
  ])
    assert.equal(fingerprintProofProjection(value), value);
});
