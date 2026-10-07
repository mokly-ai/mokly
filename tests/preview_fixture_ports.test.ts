import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { servePreviewFixture } from "./browser/preview_fixture.js";
import type { PreviewServerProcess } from "./browser/preview_process.js";

test("preview lets Wrangler own the ephemeral port and uses its reported endpoint", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const expectedUrl = "http://127.0.0.1:43217";
  let launchPort: number | undefined;
  let output = "[wrangler:info] Ready on http://127.0.0.1:43";
  const requests: string[] = [];
  const process: PreviewServerProcess = {
    get exited() {
      return false;
    },
    get output() {
      return output;
    },
    close: async () => {},
  };

  const starting = servePreviewFixture("/fixture/site", {
    launch: async (_artifact, port) => {
      launchPort = port;
      return process;
    },
    request: async (url) => {
      requests.push(url);
      return new Response();
    },
  });
  await new Promise(setImmediate);
  output += "217\n";
  t.mock.timers.tick(199);
  await new Promise(setImmediate);
  assert.deepEqual(requests, []);
  t.mock.timers.tick(1);
  const preview = await starting;

  assert.equal(launchPort, 0);
  assert.equal(preview.url, expectedUrl);
  assert.deepEqual(requests, [expectedUrl]);
});

test("preview accepts Wrangler readiness when Playwright forces ANSI colors", async () => {
  const expectedUrl = "http://127.0.0.1:43218";
  let requestedUrl: string | undefined;
  const process: PreviewServerProcess = {
    get exited() {
      return false;
    },
    get output() {
      return [
        "\u001B[32m[wrangler:info]\u001B[39m Ready on ",
        `\u001B[32m${expectedUrl}\u001B[39m\n`,
      ].join("");
    },
    close: async () => {},
  };

  const preview = await servePreviewFixture("/fixture/site", {
    launch: async () => process,
    request: async (url) => {
      requestedUrl = url;
      return new Response();
    },
  });

  assert.equal(requestedUrl, expectedUrl);
  assert.equal(preview.url, expectedUrl);
});

test("preview server HTTP startup failure closes its process scope", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  let closes = 0;
  let requests = 0;
  const process: PreviewServerProcess = {
    get exited() {
      return false;
    },
    get output() {
      return "[wrangler:info] Ready on http://127.0.0.1:43217\n";
    },
    close: async () => {
      closes += 1;
    },
  };

  const rejected = assert.rejects(
    servePreviewFixture("/fixture/site", {
      launch: async () => process,
      request: async () => {
        requests += 1;
        return new Response(undefined, { status: 503 });
      },
    }),
    /preview did not start: \[wrangler:info\] Ready on http:\/\/127\.0\.0\.1:43217/,
  );
  await expireStartup(t);
  await rejected;
  assert.equal(requests, 151);
  assert.equal(closes, 1);
});

for (const [caseName, output] of [
  ["missing announcement", "Starting local server...\n"],
  [
    "non-loopback announcement",
    "[wrangler:info] Ready on http://0.0.0.0:43217\n",
  ],
] as const) {
  test(`preview ${caseName} closes without probing an untrusted endpoint`, async (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    let closes = 0;
    let requests = 0;
    const process: PreviewServerProcess = {
      get exited() {
        return false;
      },
      get output() {
        return output;
      },
      close: async () => {
        closes += 1;
      },
    };

    const rejected = assert.rejects(
      servePreviewFixture("/fixture/site", {
        launch: async () => process,
        request: async () => {
          requests += 1;
          return new Response();
        },
      }),
      (error) =>
        error instanceof Error &&
        error.message === `preview did not start: ${output}`,
    );
    await expireStartup(t);
    await rejected;
    assert.equal(requests, 0);
    assert.equal(closes, 1);
  });
}

async function expireStartup(t: TestContext): Promise<void> {
  await new Promise(setImmediate);
  for (let probe = 0; probe < 150; probe++) {
    t.mock.timers.tick(200);
    await new Promise(setImmediate);
  }
}
