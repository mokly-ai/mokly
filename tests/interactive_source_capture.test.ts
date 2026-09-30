import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("source capture exists only for a Serve-mode Live runtime", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  const serveConfig = await loadConfig(fixture.root);

  const serve = await prepareLiveRuntime(serveConfig);
  assert.ok(serve.interactiveSources);
  assert.ok(serve.interactiveSources.files.length > 0);
  assert.ok(serve.interactiveSources.resolutions.length > 0);
  assert.ok(Object.isFrozen(serve.interactiveSources));
  assert.ok(Object.isFrozen(serve.interactiveSources.files));
  assert.ok(Object.isFrozen(serve.interactiveSources.resolutions));
  assert.ok(serve.interactiveSources.files.every(Object.isFrozen));
  assert.ok(serve.interactiveSources.resolutions.every(Object.isFrozen));
  assert.deepEqual(
    serve.interactiveSources.resolutions.find(
      (resolution) => resolution.target === "entries/fixture.mockup.tsx",
    ),
    {
      attributes: [],
      importer: { type: "entry" },
      kind: "import-statement",
      specifier: fixture.entryPath,
      target: "entries/fixture.mockup.tsx",
    },
  );

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

test("source capture keys requests by sorted import attributes", async (t) => {
  const fixture = await createFixture(
    `import details from "./details.json" with { type: "json" };\n${validEntrySource({ body: "<span>{details.marker}</span>" })}`,
    { extraConfig: 'interactive: "serve",' },
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "details.json"),
    JSON.stringify({ marker: "attribute-marker" }),
  );

  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  assert.deepEqual(
    runtime.interactiveSources?.resolutions.find(
      (resolution) => resolution.specifier === "./details.json",
    )?.attributes,
    [{ key: "type", value: "json" }],
  );
});
