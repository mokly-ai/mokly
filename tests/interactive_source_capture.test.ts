import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("source capture exists only for a Serve-mode Live runtime", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  const serveConfig = await loadConfig(fixture.root);

  const serve = await prepareLiveRuntime(serveConfig);
  assert.ok(serve.interactiveSources);
  assert.ok(serve.interactiveSources.files.length > 0);
  assert.ok(Object.isFrozen(serve.interactiveSources));
  assert.ok(Object.isFrozen(serve.interactiveSources.files));
  assert.ok(serve.interactiveSources.files.every(Object.isFrozen));

  const offConfig = { ...serveConfig, interactive: "off" as const };
  const off = await prepareLiveRuntime(offConfig);
  assert.equal(off.interactiveSources, undefined);

  const exhaustive = componentRuntime(await compileCatalogue(serveConfig));
  assert.equal(exhaustive.interactiveSources, undefined);

  const options = {
    base: "main",
    changesStatus: "unavailable" as const,
    manifest: serve.manifest,
    port: 0,
  };
  const { interactiveSources: _interactiveSources, ...withoutSources } = serve;
  await assert.rejects(
    startCatalogueServer(serve.config, {
      ...options,
      componentRuntime: withoutSources,
    }),
    /missing its accepted source capture/,
  );
  await assert.rejects(
    startCatalogueServer(off.config, {
      ...options,
      componentRuntime: {
        ...off,
        interactiveSources: serve.interactiveSources,
      },
    }),
    /non-Live runtime must not retain/,
  );
});
