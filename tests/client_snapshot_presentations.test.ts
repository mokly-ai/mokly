import assert from "node:assert/strict";
import test from "node:test";

import {
  createSnapshotPresentationLoader,
  type SnapshotPresentationEnvironment,
  type SnapshotSides,
} from "../packages/viewer/dist/previews/presentation.js";

const GENERATION =
  "https://catalogue.test/mokly-viewer/diffs/generations/comparison/";
const BEFORE = `${GENERATION}snapshots/before/mokly-generated/home/index.html`;
const AFTER = `${GENERATION}snapshots/after/mokly-generated/home/index.html`;

function documentFixture(): Document {
  let baseHref = "";
  const base = {
    setAttribute(_name: string, value: string) {
      baseHref = value;
    },
  };
  const head = { firstChild: null, insertBefore: () => base };
  const root = {
    nodeType: 1,
    get outerHTML() {
      return `<html><head><base href="${baseHref}"></head><body>Snapshot</body></html>`;
    },
  };
  return {
    body: {},
    childNodes: [root],
    createElement: () => base,
    documentElement: root,
    head,
    querySelector: () => null,
    querySelectorAll: () => [],
  } as unknown as Document;
}

function response(url: string, body: BodyInit = "<p>Snapshot</p>"): Response {
  const value = new Response(body, {
    headers: { "content-type": "text/html" },
  });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

function environment(
  fetch: SnapshotPresentationEnvironment["fetch"],
): SnapshotPresentationEnvironment {
  return {
    baseUrl: GENERATION,
    fetch,
    parse: () => documentFixture(),
  };
}

test("comparison loaders accept both snapshot sides", async () => {
  const addresses: string[] = [];
  const loader = createSnapshotPresentationLoader(
    GENERATION,
    ["before", "after"],
    { kind: "live" },
    environment(async (input) => {
      const address = String(input);
      addresses.push(address);
      return response(address);
    }),
  );
  const signal = AbortSignal.timeout(5_000);
  assert.equal((await loader.load(BEFORE, signal)).snapshotAddress, BEFORE);
  assert.equal((await loader.load(AFTER, signal)).snapshotAddress, AFTER);
  assert.deepEqual(addresses, [BEFORE, AFTER]);
});

test("comparison confinement rejects every unadvertised subtree", async () => {
  let fetches = 0;
  const loader = createSnapshotPresentationLoader(
    GENERATION,
    ["before", "after"],
    { kind: "live" },
    environment(async () => {
      fetches += 1;
      return response(AFTER);
    }),
  );
  for (const address of [
    `${GENERATION}snapshots/`,
    `${GENERATION}snapshots/before/`,
    `${GENERATION}snapshots/after/`,
    `${GENERATION}snapshots/beforeX/home/index.html`,
    `${GENERATION}snapshots/archive/home/index.html`,
    `${GENERATION.replace("comparison", "other")}snapshots/after/mokly-generated/home/index.html`,
    AFTER.replace("catalogue.test", "other.test"),
    AFTER.replace("https://", "https://reader@"),
    `${AFTER}?revision=2`,
    `${AFTER}#section`,
  ])
    await assert.rejects(
      loader.load(address, AbortSignal.timeout(5_000)),
      /^Error: The comparison is unavailable\.$/,
    );
  assert.equal(fetches, 0);
});

test("a snapshot loader requires a typed non-empty side set", () => {
  assert.throws(
    () =>
      createSnapshotPresentationLoader(
        GENERATION,
        [] as unknown as SnapshotSides,
        { kind: "live" },
        environment(async () => response(BEFORE)),
      ),
    /at least one snapshot side/i,
  );
});

test("an aborted in-flight presentation is not reused", async () => {
  let cancelled = false;
  let fetches = 0;
  const loader = createSnapshotPresentationLoader(
    GENERATION,
    ["before", "after"],
    { kind: "live" },
    environment(async () => {
      fetches += 1;
      if (fetches > 1) return response(AFTER);
      return response(
        AFTER,
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
          start() {},
        }),
      );
    }),
  );
  const firstController = new AbortController();
  const first = loader.load(AFTER, firstController.signal);
  await new Promise((resolve) => setImmediate(resolve));
  firstController.abort();
  const second = loader.load(AFTER, AbortSignal.timeout(5_000));
  await assert.rejects(first, { name: "AbortError" });
  assert.equal((await second).snapshotAddress, AFTER);
  assert.equal(cancelled, true);
  assert.equal(fetches, 2);
});

test("an abort before settlement cannot publish accepted work", async () => {
  let fetches = 0;
  let parses = 0;
  const controller = new AbortController();
  const loader = createSnapshotPresentationLoader(
    GENERATION,
    ["before", "after"],
    { kind: "live" },
    {
      baseUrl: GENERATION,
      fetch: async () => {
        fetches += 1;
        return response(AFTER);
      },
      parse: () => {
        parses += 1;
        if (parses === 1) queueMicrotask(() => controller.abort());
        return documentFixture();
      },
    },
  );
  await assert.rejects(loader.load(AFTER, controller.signal), {
    name: "AbortError",
  });
  assert.equal(
    (await loader.load(AFTER, AbortSignal.timeout(5_000))).snapshotAddress,
    AFTER,
  );
  assert.equal(fetches, 2);
});

test("failed entries are removed and comparison failures keep their copy", async () => {
  let fetches = 0;
  const loader = createSnapshotPresentationLoader(
    GENERATION,
    ["before", "after"],
    { kind: "pinned", comparisonUrl: `${GENERATION}review.json` },
    environment(async () => {
      fetches += 1;
      if (fetches === 1) throw new Error("provider details");
      return response(AFTER);
    }),
  );
  await assert.rejects(
    loader.load(AFTER, AbortSignal.timeout(5_000)),
    /^Error: The comparison is unavailable\.$/,
  );
  assert.equal(
    (await loader.load(AFTER, AbortSignal.timeout(5_000))).snapshotAddress,
    AFTER,
  );
  assert.equal(fetches, 2);
});
