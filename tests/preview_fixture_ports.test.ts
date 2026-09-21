import assert from "node:assert/strict";
import test from "node:test";

import {
  servePreviewFixture,
  type PreviewServerProcess,
} from "./browser/preview_fixture.js";

test("preview lets Wrangler own the ephemeral port and uses its reported endpoint", async () => {
  const expectedUrl = "http://127.0.0.1:43217";
  let launchPort: number | undefined;
  let output = "[wrangler:info] Ready on http://127.0.0.1:43";
  let pauses = 0;
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

  const preview = await servePreviewFixture("/fixture/site", {
    launch: async (_artifact, port) => {
      launchPort = port;
      return process;
    },
    pause: async () => {
      pauses += 1;
      output += "217\n";
    },
    request: async (url) => {
      requests.push(url);
      return new Response();
    },
    startupAttempts: 2,
  });

  assert.equal(launchPort, 0);
  assert.equal(pauses, 1);
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
    pause: async () => {},
    request: async (url) => {
      requestedUrl = url;
      return new Response();
    },
    startupAttempts: 1,
  });

  assert.equal(requestedUrl, expectedUrl);
  assert.equal(preview.url, expectedUrl);
});

test("preview server HTTP startup failure closes its process scope", async () => {
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

  await assert.rejects(
    servePreviewFixture("/fixture/site", {
      launch: async () => process,
      pause: async () => {},
      request: async () => {
        requests += 1;
        return new Response(undefined, { status: 503 });
      },
      startupAttempts: 1,
    }),
    /preview did not start: \[wrangler:info\] Ready on http:\/\/127\.0\.0\.1:43217/,
  );
  assert.equal(requests, 1);
  assert.equal(closes, 1);
});

for (const [caseName, output] of [
  ["missing announcement", "Starting local server...\n"],
  [
    "non-loopback announcement",
    "[wrangler:info] Ready on http://0.0.0.0:43217\n",
  ],
] as const) {
  test(`preview ${caseName} closes without probing an untrusted endpoint`, async () => {
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

    await assert.rejects(
      servePreviewFixture("/fixture/site", {
        launch: async () => process,
        pause: async () => {},
        request: async () => {
          requests += 1;
          return new Response();
        },
        startupAttempts: 1,
      }),
      (error) =>
        error instanceof Error &&
        error.message === `preview did not start: ${output}`,
    );
    assert.equal(requests, 0);
    assert.equal(closes, 1);
  });
}
