import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { viewRoute } from "@mokly/viewer/data";

import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { generatedText } from "../dist/build/generated_file.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { exportCatalogue } from "../dist/export/run.js";

import { copyExampleSources } from "./helpers/example_sources.js";
import { directoryFiles } from "./helpers/export_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("the example's Live mode stays outside build, check, and export bytes", async (t) => {
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/interactive-example-"),
  );
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  await copyExampleSources(root);

  const serveConfig = await loadConfig(root, "examples/basic/mokly.config.ts");
  assert.equal(serveConfig.interactive, "serve");
  const serve = await compileCatalogue(serveConfig);
  assert.equal(componentRuntime(serve).interactiveSources, undefined);
  assert.deepEqual(componentRuntime(serve).interactiveEntries, {
    "example/components/action": true,
    "example/components/action/default": true,
    "example/components/action/disabled": true,
    "example/components/action/secondary": true,
    "example/screens/details": false,
    "example/components/guest-picker": true,
    "example/components/guest-picker/dinner": true,
    "example/components/guest-picker/group": true,
    "example/screens/visit": true,
    "example/screens/welcome": true,
    "example/screens/welcome/empty": true,
    "example/components/toolbar": true,
    "example/components/toolbar/default": true,
    "example/components/workspace-note": true,
    "example/components/workspace-note/default": true,
    ...Object.fromEntries(
      Object.entries(componentRuntime(serve).interactiveEntries).filter(
        ([id]) => id.startsWith("design/"),
      ),
    ),
  });
  const guestPickerVariants = serve.manifest.entries.filter(
    (entry) =>
      entry.kind === "component" &&
      "variantOf" in entry &&
      entry.variantOf === "example/components/guest-picker",
  );
  assert.deepEqual(
    guestPickerVariants.map(({ path }) => path),
    [
      "example/components/guest-picker/dinner",
      "example/components/guest-picker/group",
    ],
  );
  assert.match(
    generatedText(
      serve.outputs.get(viewRoute("example/screens/visit", "desktop", "light")),
      viewRoute("example/screens/visit", "desktop", "light"),
    ) ?? "",
    /data-testid="guest-count"[^>]*>2</,
  );

  const offConfig = { ...serveConfig, interactive: "off" as const };
  const off = await compileCatalogue(offConfig);
  assert.deepEqual([...serve.outputs], [...off.outputs]);

  await writeCompilation(serve, serveConfig);
  checkCompilation(off, offConfig);
  await writeCompilation(off, offConfig);
  checkCompilation(serve, serveConfig);

  const exported = await exportCatalogue(serveConfig, {
    noChanges: true,
    outDir: path.join(root, "site"),
  });
  const serveFiles = await directoryFiles(exported.outDir);

  assert.deepEqual(
    [...serveFiles.keys()].filter(
      (name) =>
        name.startsWith("__mokly/client/") &&
        path.posix.basename(name).includes("react"),
    ),
    ["__mokly/client/react-shell.js"],
  );
  assert.equal(
    [...serveFiles.keys()].some((name) =>
      name.startsWith("__mokly/interactive/"),
    ),
    false,
  );
  assert.doesNotMatch(
    serveFiles.get("__mokly/catalogue.json")!.toString(),
    /"interactive"/u,
  );
  for (const [name, bytes] of serveFiles) {
    if (!name.endsWith(".html")) continue;
    const html = bytes.toString();
    assert.doesNotMatch(html, /data-mokly-interactive/u, name);
    assert.doesNotMatch(html, /data-mokly-host-capabilit/u, name);
    assert.doesNotMatch(html, /\/__mokly\/interactive\//u, name);
    assert.doesNotMatch(html, /react-host\.js/u, name);
  }
});
