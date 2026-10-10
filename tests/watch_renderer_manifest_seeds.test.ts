import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { discoverWatchResources } from "../dist/server/watch_resources.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("watch recovery seeds unlinked renderer resources from accepted usage", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "logo.svg"), "<svg></svg>");
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `
    import { renderToStaticMarkup } from "react-dom/server";
    export default ({node}) => ({
      html: '<html><body>' + renderToStaticMarkup(node) + '</body></html>',
      resources: [{path: 'logo.svg', componentIds: ['action']}]
    });`,
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.deepEqual(compilation.manifest.assetClosure, ["logo.svg"]);
  const snapshot = await discoverWatchResources(config, {
    manifest: compilation.manifest,
    outputs: compilation.outputs,
  });
  assert.deepEqual([...snapshot.closure], ["logo.svg"]);
  assert.ok(snapshot.paths.has(path.join(fixture.mockupsDir, "logo.svg")));
});
