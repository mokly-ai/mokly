import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import {
  interactiveServerFixture,
  removeInteractiveFixture,
} from "./helpers/interactive_server.js";

test("Live listener opens only for serve mode and closes with Serve", async (t) => {
  const off = await interactiveServerFixture({ mode: "off" });
  t.after(() => removeInteractiveFixture(off.fixture));
  assert.equal(off.server.interactivePort, undefined);
  assert.equal(off.server.interactiveOrigin, undefined);
  const offHtml = await (await fetch(off.server.url)).text();
  assert.doesNotMatch(offHtml, /"state":"idle"/);

  const live = await interactiveServerFixture();
  t.after(() => removeInteractiveFixture(live.fixture));
  assert.ok(live.server.interactivePort);
  assert.equal(
    live.server.interactiveOrigin,
    `http://127.0.0.1:${String(live.server.interactivePort)}`,
  );
  const origin = live.liveUrl!;
  assert.equal((await requestWithHost(origin, "attacker.example")).status, 403);
  assert.equal(
    (
      await requestWithHost(origin, "attacker.example", {
        "x-forwarded-host": `127.0.0.1:${String(live.server.interactivePort)}`,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await requestWithHost(
        origin,
        `localhost:${String(live.server.interactivePort)}`,
      )
    ).status,
    404,
  );
  assert.equal(
    (await fetch(`${origin}/__mokly/client/inspector.js`)).status,
    200,
  );
  await live.server.close();
  await assert.rejects(() => fetch(`${origin}/__mokly/client/inspector.js`));
});

test("explicit forwarded authority is admitted without trusting headers", async (t) => {
  const explicit = "https://live.example.test:8443";
  const live = await interactiveServerFixture({ interactiveOrigin: explicit });
  t.after(() => removeInteractiveFixture(live.fixture));
  const url = `${live.liveUrl}/static/${live.mobileRoute}`;
  const admitted = await requestWithHost(url, "live.example.test:8443");
  assert.equal(admitted.status, 503);
  assert.equal(
    admitted.headers["content-security-policy"],
    "frame-ancestors http: https:",
  );
  const refused = await requestWithHost(url, "attacker.example", {
    "x-forwarded-host": "live.example.test:8443",
  });
  assert.equal(refused.status, 403);
  assert.equal((await requestWithHost(url, "localhost:4173")).status, 503);
  assert.equal(
    (
      await requestWithHost(
        `${url}?mokly-host=${encodeURIComponent("https://catalogue.example.test")}`,
        "live.example.test:8443",
      )
    ).status,
    503,
  );
});

function requestWithHost(
  url: string,
  host: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<{ headers: http.IncomingHttpHeaders; status: number }> {
  return new Promise((resolve, reject) => {
    const request = http.get(
      url,
      { headers: { ...headers, host } },
      (response) => {
        response.resume();
        response.once("end", () =>
          resolve({
            headers: response.headers,
            status: response.statusCode ?? 0,
          }),
        );
      },
    );
    request.once("error", reject);
  });
}
