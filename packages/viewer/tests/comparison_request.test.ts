import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import {
  requestComparison,
  renewComparison,
} from "../src/shell/comparison_request.js";

const origin = "https://catalogue.test";
const advertised = "mokly-viewer/diffs/generations/base/";
const signal = new AbortController().signal;

function response(url: string, status = 204): Response {
  const value = new Response(null, { status });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

for (const id of ["removed", "removed/variant"]) {
  test(`live removed component ${id} uses its advertised root even on refresh`, async () => {
    const requests: string[] = [];
    const environment: ComparisonEnvironment = {
      baseUrl: origin,
      delivery: () => ({ kind: "live" }),
      fetch: async (input, init) => {
        requests.push(`${init?.method ?? "GET"} ${String(input)}`);
        assert.equal(init?.credentials, "same-origin");
        assert.equal(init?.cache, "no-store");
        assert.equal(init?.signal, signal);
        return response(String(input));
      },
    };
    const scope = { id, comparisonUrl: advertised };
    const loaded = await requestComparison(environment, scope, true, signal);
    assert.deepEqual(loaded, { url: `${origin}/${advertised}` });
    assert.equal(
      await renewComparison(environment, loaded, scope, signal),
      loaded,
    );
    assert.deepEqual(requests, [
      `GET ${origin}/${advertised}`,
      `HEAD ${origin}/${advertised}`,
    ]);
  });
}

test("a live selection follows the redirect to its generation root", async () => {
  const requests: string[] = [];
  const root = `${origin}/mokly-viewer/diffs/generations/selected-1/`;
  const environment: ComparisonEnvironment = {
    baseUrl: origin,
    delivery: () => ({ kind: "live" }),
    fetch: async (input) => {
      requests.push(String(input));
      return response(root);
    },
  };
  const loaded = await requestComparison(
    environment,
    { id: "screens/home" },
    true,
    signal,
  );
  assert.deepEqual(loaded, { url: root });
  assert.deepEqual(requests, [
    `${origin}/mokly-viewer/diffs/selection?path=screens%2Fhome&refresh=1`,
  ]);
});

test("a static comparison checks deployment once before opening", async () => {
  let checks = 0;
  const environment: ComparisonEnvironment = {
    baseUrl: origin,
    delivery: () => ({ kind: "pinned", comparisonUrl: advertised }),
    deploymentCheck: async () => {
      checks += 1;
      return true;
    },
    fetch: async () => {
      throw new Error("Pinned comparisons do not fetch the root");
    },
  };
  await requestComparison(environment, { id: "home" }, false, signal);
  assert.equal(checks, 1);
});

test("a changed deployment stops a comparison before it fetches", async () => {
  let checks = 0;
  const environment: ComparisonEnvironment = {
    baseUrl: origin,
    delivery: () => ({ kind: "pinned", comparisonUrl: advertised }),
    deploymentCheck: async () => {
      checks += 1;
      return false;
    },
    fetch: async () => {
      throw new Error("Unexpected comparison request");
    },
  };
  await assert.rejects(
    requestComparison(environment, { id: "home" }, false, signal),
    /another deployment answered/,
  );
  assert.equal(checks, 1);
});

test("a live selection that does not reach a generation root fails", async () => {
  for (const url of [
    `${origin}/mokly-viewer/diffs/selection?path=home`,
    `${origin}/mokly-viewer/diffs/generations/selected-1/review.json`,
    `https://elsewhere.test/mokly-viewer/diffs/generations/selected-1/`,
  ]) {
    const environment: ComparisonEnvironment = {
      baseUrl: origin,
      delivery: () => ({ kind: "live" }),
      fetch: async () => response(url),
    };
    await assert.rejects(
      requestComparison(environment, { id: "home" }, false, signal),
      /The comparison is unavailable/,
      url,
    );
  }
  for (const [code, status] of [
    ["invalid-input", 400],
    ["comparison-unavailable", 503],
    ["not-found", 404],
  ] as const) {
    const failing: ComparisonEnvironment = {
      baseUrl: origin,
      delivery: () => ({ kind: "live" }),
      fetch: async () => {
        const value = Response.json(
          { code, message: "Server diagnostic text." },
          {
            status,
          },
        );
        Object.defineProperty(value, "url", {
          value: `${origin}/mokly-viewer/diffs/selection?path=home`,
        });
        return value;
      },
    };
    await assert.rejects(
      requestComparison(failing, { id: "home" }, false, signal),
      { message: "The comparison is unavailable." },
    );
  }
});

test("a pinned catalogue resolves its advertised root without any request", async () => {
  const environment: ComparisonEnvironment = {
    baseUrl: `${origin}/view/home/`,
    delivery: () => ({ kind: "pinned", comparisonUrl: advertised }),
    fetch: async () => {
      throw new Error("Unexpected network request");
    },
  };
  const loaded = await requestComparison(
    environment,
    { id: "home" },
    false,
    signal,
  );
  assert.deepEqual(loaded, { url: `${origin}/${advertised}` });
  assert.equal(
    await renewComparison(environment, loaded, { id: "home" }, signal),
    loaded,
  );
  await assert.rejects(
    renewComparison(
      environment,
      { url: `${origin}/mokly-viewer/diffs/generations/other/` },
      { id: "home" },
      signal,
    ),
    /The comparison is unavailable/,
  );
});

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
          ? `${origin}/mokly-viewer/diffs/generations/other/`
          : String(input),
      );
    },
  };
  const loaded = { url: `${origin}/${advertised}` };
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
  await assert.rejects(requestComparison(environment, scope, false, signal), {
    message: "The comparison is unavailable.",
  });
  await assert.rejects(
    renewComparison(
      environment,
      { url: `${origin}/${advertised}` },
      scope,
      signal,
    ),
    { message: "The comparison is unavailable." },
  );
});

test("a loaded URL outside the advertised generation fails before renewal traffic", async () => {
  let requests = 0;
  const environment: ComparisonEnvironment = {
    baseUrl: origin,
    delivery: () => ({ kind: "live" }),
    fetch: async (input) => {
      requests++;
      return response(String(input));
    },
  };
  await assert.rejects(
    renewComparison(
      environment,
      { url: `${origin}/mokly-viewer/diffs/generations/other/` },
      { id: "removed", comparisonUrl: advertised },
      signal,
    ),
    /The comparison is unavailable/,
  );
  assert.equal(requests, 0);
});

test("a live request reads the root's empty body so the browser completes it", async () => {
  const root = `${origin}/mokly-viewer/diffs/generations/selected-1/`;
  const reads: string[] = [];
  const environment: ComparisonEnvironment = {
    baseUrl: origin,
    delivery: () => ({ kind: "live" }),
    fetch: async () => {
      const value = response(root);
      const read = value.arrayBuffer.bind(value);
      Object.defineProperty(value, "arrayBuffer", {
        value: async () => {
          reads.push(root);
          return read();
        },
      });
      return value;
    },
  };
  await requestComparison(environment, { id: "screens/home" }, false, signal);
  assert.deepEqual(reads, [root]);
});
