import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import {
  InteractiveBundleError,
  InteractiveBundleReason,
} from "../dist/interactive/errors.js";
import { startCatalogueServer } from "../dist/server/http.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("a missing captured module fails Live while Static stays available", async (t) => {
  const source = `import { marker } from "./value";\n${validEntrySource({
    body: "<span>{marker}</span>",
  })}`;
  const fixture = await createFixture(source, {
    extraConfig: 'interactive: "serve",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "value.ts"),
    'export const marker = "captured-value";\n',
  );
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  assert.ok(runtime.interactiveSources);
  const interactiveSources = {
    files: runtime.interactiveSources.files.filter(
      (file) => !file.paths.includes("entries/value.ts"),
    ),
    resolutions: runtime.interactiveSources.resolutions.filter(
      (resolution) => resolution.target !== "entries/value.ts",
    ),
  };
  const diagnostics: unknown[] = [];
  const server = await startCatalogueServer(runtime.config, {
    base: "main",
    changesStatus: "unavailable",
    componentRuntime: { ...runtime, interactiveSources },
    manifest: runtime.manifest,
    onDiagnostic: (error) => diagnostics.push(error),
    port: 0,
  });
  fixture.beforeRemove(() => server.close());

  const staticResponse = await fetch(
    `${server.url}/static/home/index.mobile.html`,
  );
  assert.equal(staticResponse.status, 200);
  const prepared = await fetch(
    `${server.url}/__mokly/interactive/${runtime.generation}/prepare`,
    { headers: { origin: server.url }, method: "POST" },
  );
  assert.equal(prepared.status, 503);
  assert.equal(
    (await fetch(`${server.url}/static/home/index.mobile.html`)).status,
    200,
  );
  const failure = diagnostics.find(
    (error) => error instanceof InteractiveBundleError,
  );
  assert.ok(failure instanceof InteractiveBundleError);
  assert.equal(failure.reason, InteractiveBundleReason.SourceNotCaptured);
  assert.equal(failure.module, "entries/value");
  assert.equal(failure.importer, "entries/fixture.mockup.tsx");
});
