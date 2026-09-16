import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";

import { componentRuntime } from "../dist/build/component_runtime.js";
import { localHost } from "../dist/server/controls/http.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("controls Host accepts only exact loopback names and canonical valid ports", () => {
  for (const host of [
    "localhost:1",
    "localhost:80",
    "localhost:65535",
    "127.0.0.1:1",
    "127.0.0.1:80",
    "127.0.0.1:65535",
  ]) {
    const request = { headers: { host }, socket: { localPort: 4173 } };
    assert.equal(localHost(request), host);
  }
});

test("controls Host rejects alternate spellings, noncanonical ports and missing authority", () => {
  for (const host of [
    undefined,
    "",
    "localhost",
    "127.0.0.1",
    "example.com:80",
    "localhost:0",
    "127.0.0.1:65536",
    "127.0.0.1:080",
    "localhost:+80",
    "localhost:8e1",
    "localhost:80.0",
    "localhost:８０",
    "localhost:9999999999999999999999",
    "LOCALHOST:80",
    "localhost.:80",
    "127.1:80",
    "[::1]:80",
    "user@localhost:80",
    " localhost:80",
    "localhost:80 ",
    "localhost:80\n",
    "localhost:80\r",
    "localhost:80\r\n",
    "localhost:80\u2028",
    "localhost:80\u2029",
    "localhost:80/path",
    "localhost:80,127.0.0.1:80",
  ]) {
    const request = {
      headers: host === undefined ? {} : { host },
      socket: { localPort: 4173 },
    };
    assert.equal(localHost(request), undefined, host ?? "Missing Host");
  }
});

test("active controls enforce loopback Host admission on ordinary catalogue routes", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentRuntime: componentRuntime(fixture.after),
  });
  t.after(() => server.close());
  const forwardedPort = Number(new URL(server.url).port) === 4173 ? 4174 : 4173;
  for (const route of [
    "/",
    "/view/components/action.html",
    "/static/components/action.variants/default.mobile.html",
  ]) {
    assert.equal(
      (
        await request(server.url + route, "GET", {
          host: "example.com:4173",
          "x-forwarded-host": `localhost:${forwardedPort}`,
        })
      ).status,
      403,
      route,
    );
    for (const hostname of ["localhost", "127.0.0.1"])
      assert.equal(
        (
          await request(server.url + route, "GET", {
            host: `${hostname}:${forwardedPort}`,
          })
        ).status,
        200,
        `${hostname} ${route}`,
      );
  }
});

test("forwarded controls preserve POST authority and preview access rules", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentRuntime: componentRuntime(fixture.after),
  });
  t.after(() => server.close());
  const page = await (
    await fetch(`${server.url}/view/components/action.html`)
  ).text();
  const { renderCapability } = JSON.parse(
    page.match(/data-workspace-data="">(.*?)<\/script>/s)![1]!,
  );
  const body = JSON.stringify({
    componentId: "action",
    variantId: "default",
    viewport: "desktop",
    colorScheme: "light",
    generation: renderCapability.generation,
    pageId: "f".repeat(32),
    overrides: { label: { kind: "set", value: ["string", "Forwarded edit"] } },
  });
  const endpoint = "/__mokly/components/render";
  const headers = {
    host: new URL(server.url).host,
    origin: server.url,
    "content-type": "application/json",
    "x-mokly-render-token": renderCapability.token as string,
  };
  const initial = await request(server.url + endpoint, "POST", headers, body);
  assert.equal(initial.status, 200, initial.body);
  const { previewUrl } = JSON.parse(initial.body);
  const forwardedPort = Number(new URL(server.url).port) === 4173 ? 4174 : 4173;
  for (const hostname of ["localhost", "127.0.0.1"]) {
    const host = `${hostname}:${forwardedPort}`;
    await t.test(
      `${host}: POST renders through a different local port`,
      async () => {
        const response = await request(
          server.url + endpoint,
          "POST",
          { ...headers, host, origin: `http://${host}` },
          body,
        );
        assert.equal(response.status, 200, response.body);
        const preview = await request(
          server.url + JSON.parse(response.body).previewUrl,
          "GET",
          { host },
        );
        assert.equal(preview.status, 200);
        assert.match(preview.body, /Forwarded edit/);
      },
    );
    for (const method of ["GET", "HEAD"])
      await t.test(
        `${host}: preview ${method} needs no Origin or POST token`,
        async () => {
          const response = await request(server.url + previewUrl, method, {
            host,
          });
          assert.equal(response.status, 200);
          assert.equal(response.headers["cache-control"], "no-store");
          assert.equal(response.headers["x-content-type-options"], "nosniff");
          if (method === "GET") assert.match(response.body, /Forwarded edit/);
          else assert.equal(response.body, "");
        },
      );
  }
  for (const host of [
    "example.com:4173",
    "127.0.0.1:0",
    "127.0.0.1:65536",
    "127.0.0.1:080",
    "localhost",
  ])
    await t.test(
      `${host}: forwarded headers cannot repair an invalid Host`,
      async () => {
        const altered = {
          ...headers,
          host,
          "x-forwarded-host": headers.host,
          "x-forwarded-port": new URL(server.url).port,
          "x-forwarded-proto": "http",
        };
        for (const method of ["POST", "GET", "HEAD"])
          assert.equal(
            (
              await request(
                server.url + (method === "POST" ? endpoint : previewUrl),
                method,
                altered,
                method === "POST" ? body : undefined,
              )
            ).status,
            403,
          );
      },
    );
  await t.test(
    "POST requires exact Origin and the render token even with a valid forwarded Host",
    async () => {
      const host = `localhost:${forwardedPort}`;
      const origin = `http://${host}`;
      for (const altered of [
        { origin: server.url },
        { origin: `${origin}/` },
        { origin: `https://${host}` },
        { origin: `http://LOCALHOST:${forwardedPort}` },
        { origin: "http://localhost" },
        { origin: undefined },
        { "x-mokly-render-token": "bad" },
        { "x-mokly-render-token": undefined },
      ])
        assert.equal(
          (
            await request(
              server.url + endpoint,
              "POST",
              {
                ...headers,
                host,
                origin,
                "x-forwarded-host": host,
                "x-forwarded-proto": "http",
                ...altered,
              },
              body,
            )
          ).status,
          403,
        );
    },
  );
});

async function request(
  url: string,
  method: string,
  headers: http.OutgoingHttpHeaders,
  body?: string,
): Promise<{
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const outgoing = http.request(
      url,
      {
        method,
        headers: Object.fromEntries(
          Object.entries(headers).filter(([, value]) => value !== undefined),
        ),
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode!,
            body: Buffer.concat(chunks).toString(),
            headers: response.headers,
          }),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}
