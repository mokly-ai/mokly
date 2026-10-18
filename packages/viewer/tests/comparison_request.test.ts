import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReviewResult } from "../src/review/types.js";
import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import {
  requestComparison,
  renewComparison,
} from "../src/shell/comparison_request.js";

const origin = "https://catalogue.test";
const advertised = "mokly-viewer/diffs/generations/base/review.json";
const result: ReviewResult = {
  schemaVersion: 8,
  baseCommit: "a".repeat(40),
  entries: [],
  affected: [],
  diagnostics: [],
};
const signal = new AbortController().signal;

function response(url: string): Response {
  const value = Response.json(result);
  Object.defineProperty(value, "url", { value: url });
  return value;
}

for (const id of ["removed", "removed/variant"]) {
  test(`live removed component ${id} uses its advertised scope even on refresh`, async () => {
    const requests: string[] = [];
    const environment: ComparisonEnvironment = {
      baseUrl: origin,
      delivery: () => ({ kind: "live" }),
      fetch: async (input, init) => {
        requests.push(String(input));
        assert.equal(init?.credentials, "same-origin");
        assert.equal(init?.signal, signal);
        return response(String(input));
      },
    };
    const scope = { id, comparisonUrl: advertised };
    const loaded = await requestComparison(environment, scope, true, signal);
    assert.deepEqual(loaded, { result, url: `${origin}/${advertised}` });
    assert.equal(
      await renewComparison(environment, loaded, scope, signal),
      loaded,
    );
    assert.deepEqual(requests, Array(2).fill(`${origin}/${advertised}`));
  });
}

test("renewal at another URL reacquires the advertised generation before returning it", async () => {
  const methods: string[] = [];
  const environment: ComparisonEnvironment = {
    baseUrl: origin,
    delivery: () => ({ kind: "live" }),
    fetch: async (input, init) => {
      assert.equal(String(input), `${origin}/${advertised}`);
      methods.push(init?.method ?? "GET");
      return response(
        init?.method === "HEAD"
          ? `${origin}/mokly-viewer/diffs/generations/other/review.json`
          : String(input),
      );
    },
  };
  const loaded = { result, url: `${origin}/${advertised}` };
  const renewed = await renewComparison(
    environment,
    loaded,
    { id: "removed", comparisonUrl: advertised },
    signal,
  );
  assert.deepEqual(methods, ["HEAD", "GET"]);
  assert.notEqual(renewed, loaded);
  assert.equal(renewed.url, loaded.url);
});

test("a null advertised comparison fails before fetching in a live host", async () => {
  const environment: ComparisonEnvironment = {
    baseUrl: origin,
    delivery: () => ({ kind: "live" }),
    fetch: async () => {
      throw new Error("Unexpected network request");
    },
  };
  const scope = { id: "removed", comparisonUrl: null };
  await assert.rejects(
    requestComparison(environment, scope, false, signal),
    /Comparisons are unavailable in this catalogue/,
  );
  await assert.rejects(
    renewComparison(
      environment,
      { result, url: `${origin}/${advertised}` },
      scope,
      signal,
    ),
    /Comparisons are unavailable in this catalogue/,
  );
});
