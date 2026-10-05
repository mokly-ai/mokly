import assert from "node:assert/strict";
import test from "node:test";

import { componentRuntime } from "../dist/build/component_runtime.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { renderCapabilityFromShell } from "./helpers/component_controls_state.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { httpRequest } from "./helpers/http_request.js";

for (const appOrigin of [
  "https://catalogue.example:8443",
  "http://catalogue.example",
])
  test(`catalogue and controls admit exactly ${appOrigin} with Live off`, async (t) => {
    const fixture = await componentReviewFixture(t, (source) => source);
    const server = await startCatalogueServer(fixture.config, {
      appOrigin,
      base: "main",
      port: 0,
      componentRuntime: componentRuntime(fixture.after),
    });
    fixture.beforeRemove(() => server.close());
    assert.equal(server.interactivePort, undefined);
    assert.equal(new URL(server.url).hostname, "127.0.0.1");
    const publicHost = new URL(appOrigin).host;
    for (const route of [
      "/",
      "/view/action/",
      "/static/action/default/index.mobile.html",
      "/__mokly/catalogue.json",
      "/__mokly/client/inspector.js",
    ])
      for (const host of [publicHost, "localhost:4173", "127.0.0.1:4174"])
        assert.equal(
          (await httpRequest(server.url + route, "GET", { host })).status,
          200,
          `${host} ${route}`,
        );
    for (const host of [
      "attacker.example:8443",
      "catalogue.example:8444",
      `${publicHost}.attacker.example`,
      publicHost.toUpperCase(),
      `${publicHost}/path`,
      "user@" + publicHost,
      appOrigin.startsWith("https:")
        ? "catalogue.example:443"
        : "catalogue.example:80",
    ])
      for (const route of [
        "/",
        "/__mokly/catalogue.json",
        "/static/action/default/index.mobile.html",
        "/__mokly/components/render",
      ])
        assert.equal(
          (
            await httpRequest(server.url + route, "GET", {
              host,
              "x-forwarded-host": publicHost,
              "x-forwarded-proto": "https",
            })
          ).status,
          403,
          `${host} ${route}`,
        );
    const page = await httpRequest(`${server.url}/view/action/`, "GET", {
      host: publicHost,
    });
    const capability = renderCapabilityFromShell(page.body)!;
    assert.ok(capability);
    const body = JSON.stringify({
      componentId: "action",
      variantPath: "action/default",
      viewport: "desktop",
      colorScheme: "light",
      generation: capability.generation,
      pageId: "f".repeat(32),
      overrides: {
        label: { kind: "set", value: ["string", "Forwarded edit"] },
      },
    });
    const endpoint = server.url + "/__mokly/components/render";
    const headers = {
      host: publicHost,
      origin: appOrigin,
      "content-type": "application/json",
      "x-mokly-render-token": capability.token,
    };
    for (const host of [publicHost, new URL(server.url).host]) {
      const rendered = await httpRequest(
        endpoint,
        "POST",
        { ...headers, host },
        body,
      );
      assert.equal(rendered.status, 200, rendered.body);
      assertNoCors(rendered.headers);
      const previewUrl = JSON.parse(rendered.body).previewUrl as string;
      for (const method of ["GET", "HEAD"]) {
        const preview = await httpRequest(server.url + previewUrl, method, {
          host: publicHost,
        });
        assert.equal(preview.status, 200);
        assertNoCors(preview.headers);
        assert.equal(
          preview.headers["content-security-policy"],
          "sandbox allow-same-origin; frame-ancestors 'self'",
        );
        if (method === "GET") assert.match(preview.body, /Forwarded edit/);
        else assert.equal(preview.body, "");
      }
    }
    for (const origin of [
      undefined,
      "null",
      "https://attacker.example",
      appOrigin + "/",
      appOrigin.toUpperCase(),
      appOrigin + "?",
      appOrigin + "#",
      appOrigin.startsWith("https:")
        ? appOrigin.replace("https:", "http:")
        : appOrigin.replace("http:", "https:"),
      "http://localhost:4173",
    ])
      assert.equal(
        (
          await httpRequest(
            endpoint,
            "POST",
            {
              ...headers,
              origin,
              "x-forwarded-host": publicHost,
              "x-forwarded-proto": "https",
            },
            body,
          )
        ).status,
        403,
        origin ?? "Missing Origin",
      );
    for (const token of [undefined, "bad"])
      assert.equal(
        (
          await httpRequest(
            endpoint,
            "POST",
            { ...headers, "x-mokly-render-token": token },
            body,
          )
        ).status,
        403,
      );
    assert.equal(
      (
        await httpRequest(
          endpoint,
          "POST",
          headers,
          body.replace(capability.generation, "e".repeat(32)),
        )
      ).status,
      409,
    );
    for (const method of ["GET", "HEAD", "OPTIONS"])
      assert.equal((await httpRequest(endpoint, method, headers)).status, 405);
    for (const host of ["localhost:4173", "127.0.0.1:4174"])
      assert.equal(
        (
          await httpRequest(
            endpoint,
            "POST",
            { ...headers, host, origin: `http://${host}` },
            body,
          )
        ).status,
        200,
      );
    const publicJson = await httpRequest(
      server.url + "/__mokly/catalogue.json",
      "GET",
      { host: publicHost },
    );
    assert.doesNotMatch(publicJson.body, /catalogue\.example/);
    assertNoCors(publicJson.headers);
  });

function assertNoCors(headers: Readonly<Record<string, unknown>>): void {
  assert.deepEqual(
    Object.keys(headers).filter((key) => key.startsWith("access-control-")),
    [],
  );
}

test("explicit app origin protects catalogue routes without a controls runtime", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const server = await startCatalogueServer(fixture.config, {
    appOrigin: "https://catalogue.example",
    base: "main",
    port: 0,
  });
  fixture.beforeRemove(() => server.close());
  for (const route of [
    "/",
    "/__mokly/catalogue.json",
    "/static/action/default/index.mobile.html",
  ]) {
    assert.equal(
      (
        await httpRequest(server.url + route, "GET", {
          host: "catalogue.example",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await httpRequest(server.url + route, "GET", {
          host: "attacker.example",
          "x-forwarded-host": "catalogue.example",
        })
      ).status,
      403,
    );
  }
});
