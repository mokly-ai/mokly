import assert from "node:assert/strict";
import test from "node:test";

import { httpRequest } from "./helpers/http_request.js";
import {
  interactiveServerFixture,
  removeInteractiveFixture,
} from "./helpers/interactive_server.js";

for (const appOrigin of [undefined, "https://catalogue.example:8443"])
  for (const interactiveOrigin of [undefined, "https://live.example:9443"])
    test(`exact app and Live policy: ${appOrigin ?? "local"} / ${interactiveOrigin ?? "local"}`, async (t) => {
      const live = await interactiveServerFixture({
        ...(appOrigin ? { appOrigin } : {}),
        ...(interactiveOrigin ? { interactiveOrigin } : {}),
      });
      t.after(() => removeInteractiveFixture(live.fixture));
      const appHost = appOrigin
        ? new URL(appOrigin).host
        : new URL(live.server.url).host;
      const liveHost = interactiveOrigin
        ? new URL(interactiveOrigin).host
        : new URL(live.liveUrl!).host;
      const endpoint = `${live.server.url}/__mokly/interactive/${live.generation}/prepare`;
      const localOrigins = [
        `http://localhost:${live.server.port}`,
        live.server.url,
      ];
      const accepted = [...localOrigins, ...(appOrigin ? [appOrigin] : [])];
      const csp = `frame-ancestors ${accepted.join(" ")}`;
      const route = `${live.liveUrl}/static/${live.mobileRoute}`;
      const permitted = await httpRequest(route, "GET", { host: liveHost });
      assert.equal(permitted.status, 503);
      assert.equal(permitted.headers["content-security-policy"], csp);
      live.bundler.succeed(live.generation);
      for (const origin of accepted) {
        const prepared = await httpRequest(endpoint, "POST", {
          host: appOrigin ? appHost : new URL(origin).host,
          origin,
        });
        if (origin !== appOrigin && appOrigin)
          assert.equal(prepared.status, 403);
        else assert.equal(prepared.status, 200);
        for (const host of [new URL(live.server.url).host, "localhost:4173"])
          assert.equal(
            (
              await httpRequest(endpoint, "POST", {
                host,
                origin: origin === appOrigin ? origin : `http://${host}`,
              })
            ).status,
            200,
          );
        const document = await httpRequest(
          `${route}?mokly-host=${encodeURIComponent(origin)}`,
          "GET",
          { host: liveHost },
        );
        assert.equal(document.status, 200, document.body);
        assert.equal(document.headers["content-security-policy"], csp);
        assertNoCors(document.headers);
      }
      for (const origin of [
        "https://attacker.example",
        "https://catalogue.example:8444",
        "https://CATALOGUE.example:8443",
        "https://catalogue.example:8443/",
        "http://catalogue.example:8443",
        "http://localhost:1",
        live.liveUrl!,
        ...(appOrigin ? [] : ["https://catalogue.example:8443"]),
      ]) {
        assert.equal(
          (
            await httpRequest(
              `${route}?mokly-host=${encodeURIComponent(origin)}`,
              "GET",
              { host: liveHost },
            )
          ).status,
          400,
          origin,
        );
        const prepared = await httpRequest(endpoint, "POST", {
          host: appHost,
          origin,
          "x-forwarded-host": appHost,
          "x-forwarded-proto": "https",
        });
        assert.equal(prepared.status, 403, origin);
        assertNoCors(prepared.headers);
      }
      for (const origin of [undefined, "null"]) {
        assert.equal(
          (await httpRequest(endpoint, "POST", { host: appHost, origin }))
            .status,
          403,
        );
      }
      for (const [url, host] of [
        [endpoint, "attacker.example"],
        [route, "attacker.example"],
        [route, "catalogue.example:8443"],
        [endpoint, "live.example:9443"],
      ])
        assert.equal(
          (
            await httpRequest(url!, "GET", {
              host,
              "x-forwarded-host":
                host === "attacker.example" ? appHost : liveHost,
            })
          ).status,
          403,
        );
      for (const method of ["GET", "HEAD", "OPTIONS"])
        assert.equal(
          (
            await httpRequest(endpoint, method, {
              host: appHost,
              origin: appOrigin ?? live.server.url,
            })
          ).status,
          405,
        );
      assert.equal(
        (
          await httpRequest(
            endpoint.replace(live.generation, "f".repeat(32)),
            "POST",
            { host: appHost, origin: appOrigin ?? live.server.url },
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await httpRequest(endpoint + "?extra=1", "POST", {
            host: appHost,
            origin: appOrigin ?? live.server.url,
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await httpRequest(
            `${route}?mokly-host=${encodeURIComponent(accepted[0]!)}&mokly-host=${encodeURIComponent(accepted[0]!)}`,
            "GET",
            { host: liveHost },
          )
        ).status,
        400,
      );
    });

function assertNoCors(headers: Readonly<Record<string, unknown>>): void {
  assert.deepEqual(
    Object.keys(headers).filter((key) => key.startsWith("access-control-")),
    [],
  );
}

test("configured app origin still cannot name the Live frame's own origin", async (t) => {
  const origin = "https://catalogue.example";
  const live = await interactiveServerFixture({
    appOrigin: origin,
    interactiveOrigin: origin,
  });
  t.after(() => removeInteractiveFixture(live.fixture));
  assert.equal(
    (
      await httpRequest(
        `${live.liveUrl}/static/${live.mobileRoute}?mokly-host=${encodeURIComponent(origin)}`,
        "GET",
        { host: new URL(origin).host },
      )
    ).status,
    400,
  );
  assert.equal(live.bundler.requests.length, 0);
});
