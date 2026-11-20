import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";

test("persistent metadata identity tracks missing jsconfig and extends but excludes unrelated module bytes", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-render-identity-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = (file: string, text: string) =>
    fs.writeFile(path.join(root, file), text);
  await write("entry.ts", "export const value='unchanged';");
  await write("sibling.ts", "export const value='first';");
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const params = bundleParams({
    sourceRoot: root,
    entryFiles: ["entry.ts", "sibling.ts"],
    storiesFiles: [],
    renderer: null,
    moduleResolution: { ...bundleParams().moduleResolution, packageRoots: [] },
  });
  const compile = () => sidecar.call<BundleResult>("bundle", params);
  const original = await compile();
  assert.equal(
    typeof original.compiled.metadataIdentity,
    "string",
    "captured metadata must supply persistent identity",
  );
  await write("sibling.ts", "export const value='second';");
  const sibling = await compile();
  assert.notEqual(sibling.compiled.identity, original.compiled.identity);
  assert.equal(
    sibling.compiled.metadataIdentity,
    original.compiled.metadataIdentity,
  );
  assert.equal(sibling.compiled.toolchain, original.compiled.toolchain);
  assert.deepEqual(
    sibling.modules.find((value) => value.path === "entry.ts"),
    original.modules.find((value) => value.path === "entry.ts"),
  );
  await write("jsconfig.json", '{"extends":"./settings.json"}');
  await write("settings.json", '{"compilerOptions":{"target":"es2022"}}');
  const present = await compile();
  assert.notEqual(
    present.compiled.metadataIdentity,
    sibling.compiled.metadataIdentity,
    "a missing candidate becoming present changes persistent identity",
  );
  assert.equal(typeof present.compiled.metadataIdentity, "string");
  await write("settings.json", '{"compilerOptions":{"target":"es2020"}}');
  const extended = await compile();
  assert.notEqual(
    extended.compiled.metadataIdentity,
    present.compiled.metadataIdentity,
    "an extends edit changes persistent identity",
  );
  assert.equal(typeof extended.compiled.metadataIdentity, "string");
  await write("jsconfig.json", '{"compilerOptions":{}}');
  const changed = await compile();
  assert.notEqual(
    changed.compiled.metadataIdentity,
    extended.compiled.metadataIdentity,
  );
  const edit = await sidecar.call<BundleResult>("bundle", {
    ...params,
    capture: "serveEdit",
  });
  assert.equal(
    edit.compiled.metadataIdentity,
    changed.compiled.metadataIdentity,
    "a retained captured generation keeps its stable identity",
  );
  const peer = path.join(root, "node_modules/react-dom");
  await fs.mkdir(path.join(peer, "lib"), { recursive: true });
  await fs.writeFile(
    path.join(peer, "package.json"),
    JSON.stringify({
      name: "react-dom",
      exports: { ".": "./lib/index.js", "./server": "./lib/server.js" },
    }),
  );
  await fs.writeFile(path.join(peer, "lib/index.js"), "module.exports={};");
  await fs.writeFile(path.join(peer, "lib/server.js"), "module.exports={};");
  const withPeer = await compile();
  assert.equal(withPeer.compiled.reuseEvidence.complete, true);
  await fs.writeFile(
    path.join(peer, "lib/package.json"),
    '{"type":"commonjs"}',
  );
  const peerScope = await compile();
  assert.notEqual(
    peerScope.compiled.metadataIdentity,
    withPeer.compiled.metadataIdentity,
    "a missing peer package scope becoming present changes persistent identity",
  );
  await sidecar.call("shutdown");
});
