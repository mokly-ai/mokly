import assert from "node:assert/strict";
import test from "node:test";

import type { FullConfig } from "@playwright/test";

import config from "../playwright.config.js";

import { exampleReady } from "./browser/example_readiness.js";
import { ownExampleServerUrl } from "./browser/example_servers.js";
import { startExampleHosts } from "./browser/example_setup.js";
import setup from "./browser/setup.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("Playwright config owns the startup hook and complete worker configuration", () => {
  assert.equal(config.globalSetup, "./tests/browser/setup.ts");
  assert.equal(config.fullyParallel, false);
  assert.equal(config.retries, 0);
  assert.deepEqual(config.projects, [{ name: "chromium" }]);
});
test("worker addresses select their parallel index and reject missing servers", () => {
  const env = {
    MOKLY_PLAYWRIGHT_URLS: JSON.stringify([
      "http://127.0.0.1:1234",
      "http://127.0.0.1:5678",
    ]),
  };
  assert.equal(ownExampleServerUrl(env), "http://127.0.0.1:1234");
  assert.equal(
    ownExampleServerUrl({ ...env, TEST_PARALLEL_INDEX: "1" }),
    "http://127.0.0.1:5678",
  );
  assert.throws(
    () => ownExampleServerUrl({ ...env, TEST_PARALLEL_INDEX: "2" }),
    { message: "Playwright worker 2 has no example server" },
  );
});
test("every worker starts through the exact shim command before readiness settles", async () => {
  const started: string[] = [];
  const ready: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = startExampleHosts(
    2,
    new AbortController().signal,
    async (args, cwd) => {
      assert.equal(cwd, repositoryRoot);
      assert.deepEqual(args, [
        "packages/mokly/bin/mokly.mjs",
        "serve",
        "--config",
        "examples/basic/mokly.config.json",
        "--base",
        "HEAD",
        "--port",
        "0",
        "--no-watch",
        "--sidecars",
        "1",
      ]);
      const url = `http://worker-${started.length}`;
      started.push(url);
      return { url, close: async () => undefined };
    },
    async (url) => {
      ready.push(url);
      if (ready.length === 2) release();
      await held;
    },
  );
  const hosts = await pending;
  assert.deepEqual(started, ["http://worker-0", "http://worker-1"]);
  assert.deepEqual(ready, started);
  assert.deepEqual(
    hosts.map((host) => host.url),
    started,
  );
});
for (const mode of ["ready", "pending", "unavailable", "ended"] as const) {
  test(`example readiness handles ${mode} through stream state`, async () => {
    let reads = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (mode === "ended") controller.close();
        else controller.enqueue(new TextEncoder().encode("data: ready\n\n"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = (async (url: string | URL | Request) => {
      if (String(url).endsWith("events")) return new Response(stream);
      if (String(url).endsWith("index.json")) {
        reads++;
        return Response.json({
          revision: 1,
          changesStatus: "disabled",
          screens: [{ path: "home" }],
          components: [],
        });
      }
      const status =
        mode === "unavailable"
          ? "unavailable"
          : mode === "ended" || (mode === "pending" && reads === 1)
            ? "pending"
            : "ready";
      return Response.json({ revision: 1, views: [{ usage: { status } }] });
    }) as typeof fetch;
    const result = exampleReady(
      "http://fixture",
      new AbortController().signal,
      request,
    );
    if (mode === "unavailable")
      await assert.rejects(result, {
        message: "Example render unavailable: home",
      });
    else if (mode === "ended")
      await assert.rejects(result, {
        message: "Example publication stream ended before readiness",
      });
    else await result;
    assert.equal(reads, mode === "pending" ? 2 : 1);
    if (mode !== "ended") assert.equal(cancelled, true);
  });
}

test("the configured setup publishes each prepared worker and restores its environment", async (context) => {
  const previous = process.env["MOKLY_PLAYWRIGHT_WORKERS"];
  const previousUrls = process.env["MOKLY_PLAYWRIGHT_URLS"];
  process.env["MOKLY_PLAYWRIGHT_WORKERS"] = "2";
  context.after(() => {
    if (previous === undefined) delete process.env["MOKLY_PLAYWRIGHT_WORKERS"];
    else process.env["MOKLY_PLAYWRIGHT_WORKERS"] = previous;
  });
  const closed: number[] = [];
  const copiedBefore = process.env["MOKLY_PLAYWRIGHT_COPIED_URL"];
  const close = await setup({ workers: 2 } as FullConfig, {
    start: async (count) => {
      assert.equal(count, 2);
      return [0, 1].map((index) => ({
        url: `http://worker-${index}`,
        close: async () => {
          closed.push(index);
        },
      }));
    },
    comparisonHost: async () => ({
      directory: "/comparison",
      url: "http://comparison",
      close: async () => {
        closed.push(3);
      },
    }),
    staticHost: async () => ({
      directory: "/copied",
      url: "http://static",
      close: async () => {
        closed.push(2);
      },
    }),
    host: async () => {
      throw new Error("Serve setup must start worker servers");
    },
  });
  assert.equal(
    process.env["MOKLY_PLAYWRIGHT_URLS"],
    '["http://worker-0","http://worker-1"]',
  );
  assert.equal(process.env["MOKLY_PLAYWRIGHT_COPIED_URL"], "http://static");
  await close();
  assert.deepEqual(closed.sort(), [0, 1, 2, 3]);
  assert.equal(process.env["MOKLY_PLAYWRIGHT_COPIED_URL"], copiedBefore);
  assert.equal(process.env["MOKLY_PLAYWRIGHT_URLS"], previousUrls);
});
test("a failed worker drains successful siblings before setup rejects", async () => {
  const failure = new Error("fixture startup refused");
  let count = 0;
  let closed = false;
  await assert.rejects(
    startExampleHosts(
      2,
      new AbortController().signal,
      async () => {
        if (count++ === 1) throw failure;
        return {
          url: "http://first",
          close: async () => {
            closed = true;
          },
        };
      },
      async () => {},
    ),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.message, "Example worker setup failed");
      assert.deepEqual(error.errors, [failure]);
      assert.equal(closed, true);
      return true;
    },
  );
});

test("a copied-output setup failure drains Serve hosts and restores both URL channels", async () => {
  const expected = new Error("copied build failed");
  const before = [
    process.env["MOKLY_PLAYWRIGHT_URLS"],
    process.env["MOKLY_PLAYWRIGHT_COPIED_URL"],
  ];
  let closed = false;
  await assert.rejects(
    setup({ workers: 1 } as FullConfig, {
      start: async () => [
        {
          url: "http://serve",
          close: async () => {
            closed = true;
          },
        },
      ],
      host: async () => {
        throw new Error("not a manual static run");
      },
      comparisonHost: async () => ({
        directory: "/comparison",
        url: "http://comparison",
        close: async () => {},
      }),
      staticHost: async () => {
        throw expected;
      },
    }),
    (error) => error === expected,
  );
  assert.equal(closed, true);
  assert.deepEqual(
    [
      process.env["MOKLY_PLAYWRIGHT_URLS"],
      process.env["MOKLY_PLAYWRIGHT_COPIED_URL"],
    ],
    before,
  );
});
