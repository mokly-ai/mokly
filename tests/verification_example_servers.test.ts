import assert from "node:assert/strict";
import test from "node:test";

import type { FullConfig } from "@playwright/test";

import browserConfig from "../playwright.config.js";

import {
  exampleServerPorts,
  ownExampleServerPort,
} from "./browser/example_servers.js";
import setup from "./browser/setup.js";

test("each Playwright worker gets one example server on consecutive ports", () => {
  assert.deepEqual(
    exampleServerPorts({ MOKLY_PLAYWRIGHT_WORKERS: "3" }),
    [4517, 4518, 4519],
  );
  assert.deepEqual(
    exampleServerPorts({
      MOKLY_PLAYWRIGHT_PORT: "5000",
      MOKLY_PLAYWRIGHT_WORKERS: "2",
    }),
    [5000, 5001],
  );
  assert.deepEqual(
    exampleServerPorts({
      MOKLY_PLAYWRIGHT_PORT: "65535",
      MOKLY_PLAYWRIGHT_WORKERS: "1",
    }),
    [65_535],
  );
});

test("the example port range must fit the TCP port space", () => {
  for (const [port, workers] of [
    ["65535", "2"],
    ["0", "1"],
    ["-1", "1"],
    ["1.5", "1"],
    ["http", "1"],
  ] as const)
    assert.throws(
      () =>
        exampleServerPorts({
          MOKLY_PLAYWRIGHT_PORT: port,
          MOKLY_PLAYWRIGHT_WORKERS: workers,
        }),
      {
        message: `MOKLY_PLAYWRIGHT_PORT must start ${workers} consecutive available TCP port(s); received ${port}`,
      },
    );
});

test("a worker uses the server at its parallel index", () => {
  const ports = [5000, 5001, 5002];
  assert.equal(ownExampleServerPort(ports, {}), 5000);
  assert.equal(ownExampleServerPort(ports, { TEST_PARALLEL_INDEX: "0" }), 5000);
  assert.equal(ownExampleServerPort(ports, { TEST_PARALLEL_INDEX: "2" }), 5002);
  assert.throws(
    () => ownExampleServerPort(ports, { TEST_PARALLEL_INDEX: "3" }),
    {
      message:
        "Playwright worker 3 has no example server; set MOKLY_PLAYWRIGHT_WORKERS instead of passing --workers",
    },
  );
});

test("the Playwright config starts one example server per worker", () => {
  const ports = exampleServerPorts();
  assert.equal(browserConfig.workers, ports.length);
  assert.equal(browserConfig.use?.baseURL, `http://127.0.0.1:${ports[0]}`);
  const servers = browserConfig.webServer;
  assert.ok(Array.isArray(servers));
  assert.deepEqual(
    servers.map((server) => server.url),
    ports.map((port) => `http://127.0.0.1:${port}/`),
  );
  for (const [offset, server] of servers.entries()) {
    assert.equal(
      server.command,
      `node dist/cli/bin.js serve --config examples/basic/mokly.config.ts --base HEAD --port ${ports[offset]} --no-watch`,
    );
    assert.equal(server.reuseExistingServer, false);
  }
});

test("global setup rejects workers without a prepared example server", async () => {
  const ports = exampleServerPorts();
  const workers = ports.length + 1;
  await assert.rejects(
    setup({ projects: [], workers } as unknown as FullConfig),
    {
      message: `Playwright runs ${workers} workers but starts ${ports.length} example server(s); set MOKLY_PLAYWRIGHT_WORKERS=${workers} instead of passing --workers`,
    },
  );
});
