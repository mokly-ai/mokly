import assert from "node:assert/strict";
import test from "node:test";

import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { parseArguments } from "../dist/cli/arguments.js";
import { loadConfig } from "../dist/config/load.js";
import { GenerationInteractiveBundles } from "../dist/interactive/bundle_state.js";
import {
  NodeInteractiveServerFactory,
  type InteractiveServerOptions,
} from "../dist/interactive/server.js";
import { InteractiveRequestRouter } from "../dist/interactive/server_router.js";
import { startCatalogueServer } from "../dist/server/http.js";
import type { ServerOptions } from "../dist/server/http_types.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { httpRequest } from "./helpers/http_request.js";
import {
  ControlledInteractiveBundler,
  interactiveServerFixture,
  removeInteractiveFixture,
} from "./helpers/interactive_server.js";

const punctuation = [
  "*",
  ";",
  ",",
  "'",
  '"',
  "(",
  ")",
  "=",
  "{",
  "}",
  "`",
  "!",
  "$",
  "&",
  "+",
  "~",
];
const invalid = [
  ...punctuation.map((character) => `https://a${character}b.example`),
  "https://-catalogue.example",
  "https://catalogue-.example",
  "https://catalogue..example",
  "https://catalogue.example.",
  "https://a_b.example",
  `https://${"a".repeat(64)}.example`,
];

for (const option of ["--app-origin", "--interactive-origin"] as const) {
  for (const origin of invalid)
    test(`${option} refuses Host and CSP punctuation: ${origin}`, () => {
      assert.throws(
        () => parseArguments(["serve", `${option}=${origin}`]),
        /canonical HTTP\(S\) origin/,
      );
    });
  for (const origin of [
    "https://catalogue.example",
    "https://a-b.c9.example",
    new URL("https://bücher.example").origin,
    "http://127.0.0.1",
    "http://[::1]",
    "https://[2001:db8::1]:8443",
    "https://catalogue.example:8443",
  ])
    test(`${option} accepts a canonical hostname, IP literal and port: ${origin}`, () => {
      const args = parseArguments(["serve", option, origin]);
      assert.equal(
        option === "--app-origin" ? args.appOrigin : args.interactiveOrigin,
        origin,
      );
    });
  test(`${option} keeps exact origin comparison after IDNA conversion`, () => {
    assert.equal(
      new URL("https://bücher.example").hostname,
      "xn--bcher-kva.example",
    );
    assert.throws(
      () => parseArguments(["serve", option, "https://bücher.example"]),
      /canonical HTTP\(S\) origin/,
    );
  });
}

test("programmatic catalogue startup refuses unsafe origins before any response can expose them", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  for (const name of ["appOrigin", "interactiveOrigin"])
    for (const origin of invalid)
      await assert.rejects(
        () =>
          startCatalogueServer(runtime.config, {
            [name]: origin,
            base: "main",
            componentRuntime: runtime,
            manifest: runtime.manifest,
            port: 0,
          }).then(async (server) => {
            await server.close();
          }),
        { code: "server-failed" },
        `${name}: ${origin}`,
      );
});

test("direct Live listener and router startup also refuse unsafe origin options", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const bundler = new ControlledInteractiveBundler();
  const factory = new NodeInteractiveServerFactory(bundler);
  let captured: InteractiveServerOptions | undefined;
  const server = await startCatalogueServer(runtime.config, {
    base: "main",
    componentRuntime: runtime,
    interactivePort: 0,
    interactiveServerFactory: {
      start(options) {
        captured = options;
        return factory.start(options);
      },
    },
    manifest: runtime.manifest,
    port: 0,
  });
  fixture.beforeRemove(() => server.close());
  assert.ok(captured);
  const bundles = new GenerationInteractiveBundles(
    bundler,
    () => undefined,
    () => undefined,
  );
  for (const name of ["appOrigin", "interactiveOrigin"])
    for (const origin of invalid) {
      const options = { ...captured, [name]: origin, port: 0 };
      await assert.rejects(
        () => factory.start(options).then(async (listener) => listener.close()),
        { code: "server-failed" },
        `${name}: ${origin}`,
      );
      assert.throws(
        () =>
          new InteractiveRequestRouter(
            bundles,
            server.interactivePort!,
            options,
          ),
        { code: "server-failed" },
        `${name}: ${origin}`,
      );
    }
});

test("caller mutation cannot replace admitted origins in headers or descriptors", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const appOrigin = "https://catalogue.example";
  const interactiveOrigin = "https://live.example";
  const options: ServerOptions = {
    appOrigin,
    interactiveOrigin,
    base: "main",
    componentRuntime: runtime,
    manifest: runtime.manifest,
    port: 0,
  };
  const server = await startCatalogueServer(runtime.config, options);
  fixture.beforeRemove(() => server.close());
  options.appOrigin = "https://a;b.example";
  options.interactiveOrigin = "https://a,b.example";
  const shell = await httpRequest(server.url, "GET", {
    host: new URL(appOrigin).host,
  });
  assert.equal(shell.status, 200);
  assert.match(shell.body, /"origin":"https:\/\/live\.example"/);
  assert.doesNotMatch(shell.body, /a;b\.example|a,b\.example/);
  assert.equal(
    (
      await httpRequest(
        `${server.url}/__mokly/interactive/${runtime.generation}/prepare`,
        "POST",
        { origin: appOrigin },
      )
    ).status,
    200,
  );
  const document = await httpRequest(
    `http://127.0.0.1:${server.interactivePort}/static/screens/home.mobile.html?mokly-host=${encodeURIComponent(appOrigin)}`,
    "GET",
    { host: new URL(interactiveOrigin).host },
  );
  assert.equal(document.status, 200);
  assert.equal(
    document.headers["content-security-policy"],
    `frame-ancestors http://localhost:${server.port} ${server.url} ${appOrigin}`,
  );
});

test("IDNA and IPv6 origins stay exact in Host, CSP and private descriptors", async (t) => {
  const appOrigin = "https://xn--bcher-kva.example";
  const interactiveOrigin = "https://[2001:db8::1]:8443";
  const live = await interactiveServerFixture({ appOrigin, interactiveOrigin });
  t.after(() => removeInteractiveFixture(live.fixture));
  const shell = await httpRequest(live.server.url, "GET", {
    host: new URL(appOrigin).host,
  });
  assert.equal(shell.status, 200);
  assert.match(shell.body, /"origin":"https:\/\/\[2001:db8::1\]:8443"/);
  const document = await httpRequest(
    `${live.liveUrl}/static/${live.mobileRoute}?mokly-host=${encodeURIComponent(appOrigin)}`,
    "GET",
    { host: new URL(interactiveOrigin).host },
  );
  assert.equal(document.status, 503);
  assert.equal(
    document.headers["content-security-policy"],
    `frame-ancestors http://localhost:${live.server.port} ${live.server.url} ${appOrigin}`,
  );
});
