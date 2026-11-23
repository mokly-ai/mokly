import assert from "node:assert/strict";
import test from "node:test";

import { prepareRecipeEncoding } from "../packages/mokly/src/sidecar/recipe-encoding.js";
import { checkRecipeSize } from "../packages/mokly/src/sidecar/recipe-size.js";
import { encodeResponse } from "../packages/mokly/src/sidecar/transport.js";

import { legacyJsonText } from "./helpers/sidecar_legacy_json.js";
import {
  recipeEncodingFixture,
  recipeEnvelopeBytes,
} from "./helpers/sidecar_recipe_encoding.js";

test("new recipe sizing and sending encode shared code and module text once", () => {
  const { params, result, reads } = recipeEncodingFixture();
  const expected = legacyJsonText({ id: 7, result }) + "\n";
  const next = legacyJsonText({ id: 8, result }) + "\n";
  const { bytes } = recipeEnvelopeBytes(params, result);
  const encoding = new Map<object, string>();
  reads.code = reads.path = 0;
  checkRecipeSize(params, result, bytes, encoding);
  assert.deepEqual(reads, { code: 1, path: 1 });
  prepareRecipeEncoding(result, encoding);
  assert.equal(encodeResponse(7, { result }), expected);
  assert.deepEqual(reads, { code: 1, path: 1 });
  assert.equal(encodeResponse(8, { result }), next);
  assert.deepEqual(reads, { code: 2, path: 2 });
  assert.equal(encodeResponse(9, { result: null }), '{"id":9,"result":null}\n');
});

test("shared recipe sizes keep exact envelope limits and prune plans before evidence", () => {
  for (const larger of ["restore", "response"]) {
    const { params, result, reads } = recipeEncodingFixture(larger);
    delete result.plan;
    const originalEvidence = result.compiled.reuseEvidence;
    const full = recipeEnvelopeBytes(params, result);
    assert.equal(full.response > full.restore, larger === "response");
    const encoding = new Map<object, string>();
    reads.code = reads.path = 0;
    checkRecipeSize(params, result, full.bytes, encoding);
    assert.deepEqual(reads, { code: 1, path: 1 });
    assert.equal(result.plan, undefined);
    assert.equal(result.compiled.reuseEvidence, originalEvidence);

    result.compiled.reuseEvidence = {
      complete: false,
      durable: false,
      inputs: {},
    };
    const withoutEvidence = recipeEnvelopeBytes(params, result).bytes;
    result.compiled.reuseEvidence = originalEvidence;
    reads.code = reads.path = 0;
    const pruned = new Map<object, string>();
    checkRecipeSize(params, result, withoutEvidence, pruned);
    assert.equal(result.plan, undefined);
    assert.deepEqual(result.compiled.reuseEvidence, {
      complete: false,
      durable: false,
      inputs: {},
    });
    assert.deepEqual(reads, { code: 2, path: 1 });
    const expected = legacyJsonText({ id: 1, result }) + "\n";
    prepareRecipeEncoding(result, pruned);
    assert.equal(encodeResponse(1, { result }), expected);
    assert.throws(
      () => checkRecipeSize(params, result, withoutEvidence - 1, new Map()),
      {
        code: "bundle-failed",
        message: `Compiled bundle data needs ${withoutEvidence} bytes. The sidecar limit is ${withoutEvidence - 1} bytes. Reduce the bundle and retry.`,
      },
    );
  }
  const { params, result, reads } = recipeEncodingFixture("response");
  const plan = result.plan;
  assert.ok(plan);
  const evidence = result.compiled.reuseEvidence;
  delete result.plan;
  const withoutPlan = recipeEnvelopeBytes(params, result).bytes;
  result.plan = plan;
  reads.code = reads.path = 0;
  checkRecipeSize(params, result, withoutPlan, new Map());
  assert.equal(result.plan, undefined);
  assert.equal(result.compiled.reuseEvidence, evidence);
  assert.deepEqual(reads, { code: 1, path: 1 });
});

test("a prepared recipe encodes replaced members normally and keeps other responses separate", () => {
  const { params, result } = recipeEncodingFixture();
  const encoding = new Map<object, string>();
  checkRecipeSize(params, result, undefined, encoding);
  prepareRecipeEncoding(result, encoding);
  result.compiled = { ...result.compiled, code: "replaced" };
  result.modules = [{ path: "replacement.ts", imports: [] }];
  const expected = legacyJsonText({ id: 2, result }) + "\n";
  const ordinary = { result: { code: "ordinary", props: { value: -0 } } };
  assert.equal(
    encodeResponse(1, ordinary),
    legacyJsonText({ id: 1, ...ordinary }) + "\n",
  );
  assert.equal(encodeResponse(2, { result }), expected);
});
