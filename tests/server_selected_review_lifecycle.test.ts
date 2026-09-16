import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

import type {
  SelectedReviewProvider,
  SelectedReviewSource,
} from "../dist/review/selection_types.js";
import { SelectedReviewRoutes } from "../dist/server/selected_review_routes.js";
import type { ReviewArtifact } from "../packages/viewer/dist/review/types.js";

const source: SelectedReviewSource = {
  before: {
    entries: [],
    generatedBy: "mokly",
    schemaVersion: 5,
    sourceFiles: [],
  },
  after: {
    entries: [],
    generatedBy: "mokly",
    schemaVersion: 5,
    sourceFiles: [],
  },
  baseCommit: "a".repeat(40),
  baseRef: "HEAD",
  changedPaths: [],
  headDigests: {},
};

function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function artifact(route: string): ReviewArtifact {
  return {
    files: new Map([["snapshots/after/pane.html", `<main>${route}</main>`]]),
    result: {
      baseCommit: source.baseCommit,
      baseRef: source.baseRef,
      changedPaths: [],
      ignoredImpact: [],
      schemaVersion: 2,
      screens: [],
      sharedImpact: [],
    },
  };
}

async function start(
  t: { after(fn: () => Promise<void>): void },
  provider: SelectedReviewProvider,
) {
  const routes = new SelectedReviewRoutes(provider, () => source, "HEAD");
  const server = createServer((request, response) => {
    void routes.handle(
      new URL(request.url!, "http://localhost"),
      response,
      request.method ?? "GET",
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await routes.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    routes,
    request: (route: string, refresh = false) =>
      fetch(
        `http://127.0.0.1:${address.port}/__mokly/diffs/review.json?route=${encodeURIComponent(route)}${refresh ? "&refresh=1" : ""}`,
      ),
  };
}

test("selected comparisons coalesce matching requests and serialize different routes", async (t) => {
  const arrived = gate();
  const release = gate();
  t.after(() => release.release());
  const calls: string[] = [];
  const server = await start(t, {
    async generate(_source, selection) {
      calls.push(selection.route);
      if (calls.length === 1) {
        arrived.release();
        await release.promise;
      }
      return artifact(selection.route);
    },
  });
  const first = server.request("first.html");
  await arrived.promise;
  const same = server.request("first.html");
  const different = server.request("second.html");
  release.release();
  const [a, b, c] = await Promise.all([first, same, different]);
  for (const response of [a, b, c]) assert.equal(response.status, 200);
  assert.equal(a.url, b.url);
  assert.notEqual(a.url, c.url);
  assert.deepEqual(calls, ["first.html", "second.html"]);
  assert.match(
    await (await fetch(new URL("snapshots/after/pane.html", c.url))).text(),
    /second.html/,
  );
  const refreshed = await server.request("first.html", true);
  assert.notEqual(refreshed.url, a.url);
  assert.deepEqual(calls, ["first.html", "second.html", "first.html"]);
  assert.match(
    await (await fetch(new URL("snapshots/after/pane.html", a.url))).text(),
    /first.html/,
  );
});

for (const action of ["invalidate", "close"] as const)
  test(`${action} cancels and drains selected generation before it can publish`, async (t) => {
    const arrived = gate();
    const drained = gate();
    let aborted = false;
    let attempts = 0;
    const server = await start(t, {
      async generate(_source, selection, signal) {
        if (++attempts === 1) {
          arrived.release();
          await new Promise<void>((resolve) =>
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                resolve();
              },
              { once: true },
            ),
          );
          await drained.promise;
        }
        return artifact(selection.route);
      },
    });
    const pending = server.request("first.html");
    await arrived.promise;
    let closed = false;
    const completion =
      action === "close"
        ? server.routes.close().then(() => {
            closed = true;
          })
        : Promise.resolve(server.routes.invalidate());
    assert.equal(aborted, true);
    assert.equal(closed, false);
    drained.release();
    await completion;
    assert.equal((await pending).status, 500);
    assert.equal(
      (await server.request("first.html")).status,
      action === "close" ? 500 : 200,
    );
  });

test("selected snapshot failures do not poison the queue or overwrite retained panes", async (t) => {
  let attempts = 0;
  const server = await start(t, {
    async generate(_source, selection) {
      if (++attempts === 2) throw new Error("Failed capture");
      return artifact(selection.route);
    },
  });
  const first = await server.request("first.html");
  assert.equal(first.status, 200);
  assert.equal((await server.request("first.html", true)).status, 500);
  assert.match(
    await (await fetch(new URL("snapshots/after/pane.html", first.url))).text(),
    /first.html/,
  );
  const retry = await server.request("first.html", true);
  assert.equal(retry.status, 200);
  assert.notEqual(retry.url, first.url);
});

test("HEAD renews selected snapshots without capture and expired selections can be reacquired", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const calls: string[] = [];
  const server = await start(t, {
    async generate(_source, selection) {
      calls.push(selection.route);
      return artifact(selection.route);
    },
  });
  const first = await server.request("first.html");
  assert.equal(first.status, 200);
  now += 59_000;
  const renewed = await fetch(first.url, { method: "HEAD" });
  assert.equal(renewed.status, 200);
  assert.equal(renewed.headers.get("cache-control"), "no-store");
  assert.equal(await renewed.text(), "");
  assert.deepEqual(calls, ["first.html"]);
  now += 59_000;
  assert.equal((await server.request("second.html")).status, 200);
  const pane = new URL("snapshots/after/pane.html", first.url);
  assert.equal((await fetch(pane)).status, 200);
  now += 60_001;
  assert.equal((await server.request("third.html")).status, 200);
  assert.equal((await fetch(first.url, { method: "HEAD" })).status, 404);
  assert.equal((await fetch(pane)).status, 404);
  const recovered = await server.request("first.html");
  assert.equal(recovered.status, 200);
  assert.notEqual(recovered.url, first.url);
  assert.equal(
    (await fetch(new URL("snapshots/after/pane.html", recovered.url))).status,
    200,
  );
  assert.deepEqual(calls, [
    "first.html",
    "second.html",
    "third.html",
    "first.html",
  ]);
});
