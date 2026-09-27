import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { MoklyError } from "../dist/errors.js";

import {
  interactiveServerFixture,
  optedOutFixtureSource,
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

test("Live listener exposes only its allowlisted routes and headers", async (t) => {
  const live = await interactiveServerFixture();
  t.after(() => removeInteractiveFixture(live.fixture));
  const origin = live.liveUrl!;
  for (const pathname of [
    "/",
    "/__mokly/catalogue.json",
    "/__mokly/components/render",
    "/__mokly/diffs/review.json",
    "/__mokly/interactive/" + live.generation + "/prepare",
    "/comparison",
    "/review",
    "/upload",
  ]) {
    const response = await fetch(origin + pathname);
    assert.equal(response.status, 404, pathname);
    assertPolicyHeaders(response);
  }
  const asset = await fetch(`${origin}/static/asset.css`);
  assert.equal(asset.status, 200);
  assert.equal(await asset.text(), "body { color: rebeccapurple; }\n");
  assertPolicyHeaders(asset);
  const inspector = await fetch(`${origin}/__mokly/client/inspector.js`);
  assert.equal(inspector.status, 200);
  assert.match(inspector.headers.get("content-type") ?? "", /javascript/);
  assertPolicyHeaders(inspector);
  assert.equal(inspector.headers.get("access-control-allow-origin"), null);
  assert.equal(
    (await fetch(`${origin}/__mokly/client/inspector.js?extra=1`)).status,
    404,
  );
});

test("Live documents coalesce preparation and become ready", async (t) => {
  const live = await interactiveServerFixture();
  t.after(() => removeInteractiveFixture(live.fixture));
  const route = `${live.liveUrl}/static/${live.mobileRoute}`;
  const [first, second] = await Promise.all([fetch(route), fetch(route)]);
  for (const response of [first, second]) {
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      generation: live.generation,
      state: "building",
    });
    assertPolicyHeaders(response);
    assert.equal(
      response.headers.get("content-security-policy"),
      `frame-ancestors http://localhost:${String(live.server.port)} http://127.0.0.1:${String(live.server.port)}`,
    );
  }
  assert.equal(live.bundler.requests.length, 1);
  const prepareUrl = `${live.server.url}/__mokly/interactive/${live.generation}/prepare`;
  assert.equal((await fetch(prepareUrl, { method: "POST" })).status, 403);
  assert.equal(
    (
      await fetch(prepareUrl, {
        headers: { origin: "http://localhost:1" },
        method: "POST",
      })
    ).status,
    403,
  );
  const preparation = fetch(prepareUrl, prepareInit(live.server.url));
  live.bundler.succeed(live.generation);
  const prepared = await preparation;
  assert.equal(prepared.status, 200);
  assert.deepEqual(await prepared.json(), {
    generation: live.generation,
    state: "ready",
  });
  assertPolicyHeaders(prepared);

  const document = await fetch(`${route}?scheme=light&viewport=mobile`);
  assert.equal(document.status, 200);
  const html = await document.text();
  assert.match(html, /data-mokly-interactive/);
  assert.match(
    html,
    new RegExp(`/__mokly/interactive/${live.generation}/bundle\\.js`),
  );
  assert.equal((await fetch(`${route}?viewport=desktop`)).status, 404);
  assert.equal((await fetch(`${route}?unknown=1`)).status, 400);
  assert.equal(
    (await fetch(`${route}?mokly-host=${encodeURIComponent(live.server.url)}`))
      .status,
    200,
  );
  assert.equal(
    (
      await fetch(
        `${route}?mokly-host=${encodeURIComponent(`http://localhost:${String(live.server.port)}`)}`,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(
        `${route}?mokly-host=${encodeURIComponent("https://catalogue.example.test")}`,
      )
    ).status,
    400,
  );
  assert.equal(
    (await fetch(`${route}?mokly-host=${encodeURIComponent(live.liveUrl!)}`))
      .status,
    400,
  );
  assert.equal(
    (
      await fetch(
        `${route}?mokly-host=${encodeURIComponent(live.server.url)}&mokly-host=${encodeURIComponent(live.server.url)}`,
      )
    ).status,
    400,
  );
  assert.equal((await fetch(`${route}?mokly-host=not-an-origin`)).status, 400);
  const bundle = await fetch(
    `${live.liveUrl}/__mokly/interactive/${live.generation}/bundle.js`,
  );
  assert.equal(bundle.status, 200);
  assert.equal(await bundle.text(), "globalThis.__moklyLiveTest = true;");
});

test("Live bundle failures are typed, retained and logged once", async (t) => {
  const live = await interactiveServerFixture();
  t.after(() => removeInteractiveFixture(live.fixture));
  const route = `${live.liveUrl}/static/${live.mobileRoute}`;
  assert.equal((await fetch(route)).status, 503);
  const failure = new MoklyError(
    "interactive-bundle",
    "fixture cannot run in a browser",
  );
  live.bundler.fail(live.generation, failure);
  await setImmediate();
  for (let index = 0; index < 2; index += 1) {
    const response = await fetch(route);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      generation: live.generation,
      state: "failed",
    });
  }
  assert.deepEqual(live.diagnostics, [failure]);
  assert.equal(live.bundler.requests.length, 1);
  const preparation = await fetch(
    `${live.server.url}/__mokly/interactive/${live.generation}/prepare`,
    prepareInit(live.server.url),
  );
  assert.equal(preparation.status, 503);
  assert.deepEqual(await preparation.json(), {
    generation: live.generation,
    state: "failed",
  });
  assert.equal(
    (
      await fetch(
        `${live.server.url}/__mokly/interactive/${"f".repeat(32)}/prepare`,
        prepareInit(live.server.url),
      )
    ).status,
    404,
  );
});

test("internal Live bundle faults return 500 instead of typed unavailability", async (t) => {
  const live = await interactiveServerFixture();
  t.after(() => removeInteractiveFixture(live.fixture));
  const route = `${live.liveUrl}/static/${live.mobileRoute}`;
  assert.equal((await fetch(route)).status, 503);
  live.bundler.succeed(
    live.generation,
    "export const mismatch = true;",
    "f".repeat(32),
  );
  await setImmediate();
  const response = await fetch(route);
  assert.equal(response.status, 500);
  assert.match(await response.text(), /Could not prepare this Live preview/);
  const preparation = await fetch(
    `${live.server.url}/__mokly/interactive/${live.generation}/prepare`,
    prepareInit(live.server.url),
  );
  assert.equal(preparation.status, 500);
  assert.deepEqual(await preparation.json(), {
    generation: live.generation,
    state: "failed",
  });
  assert.equal(live.diagnostics.length, 1);
});

test("ineligible views return 404 before bundle work", async (t) => {
  const live = await interactiveServerFixture({
    source: optedOutFixtureSource(),
  });
  t.after(() => removeInteractiveFixture(live.fixture));
  const optedOut = await fetch(`${live.liveUrl}/static/${live.mobileRoute}`);
  assert.equal(optedOut.status, 404);
  assert.equal(
    (await fetch(`${live.liveUrl}/static/user-flows/tour.html`)).status,
    404,
  );
  assert.equal(live.bundler.requests.length, 0);
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

function assertPolicyHeaders(response: Response): void {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}

function prepareInit(origin: string): RequestInit {
  return { headers: { origin }, method: "POST" };
}

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
