import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";

import { write } from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";
import { pnpFolder } from "./helpers/pnp_folder.js";

for (const kind of ["PnP state", "inactive folder manifest"] as const)
  test(`full and marked folder selections share present ${kind} metadata`, async (context) => {
    const fixture =
      kind === "PnP state"
        ? await pnpFolder(context, "binding")
        : await folderPackage(context, {
            name: kind,
            manifest:
              '{"name":"chosen","exports":{"./sub/":{"node":"./lib/","default":"./other/"}}}',
          });
    if (kind === "inactive folder manifest")
      await write(
        path.join(fixture.root, "other/value/package.json"),
        '{"main":"./index.js"}',
      );
    const full = await bundle(fixture.params, build);
    const marked = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    const present = (inputs: Record<string, string | null>) =>
      Object.fromEntries(
        Object.entries(inputs).filter(([, digest]) => digest !== null),
      );
    assert.deepEqual(
      present(marked.result.compiled.metadataInputs),
      present(full.result.compiled.metadataInputs),
    );
    assert.deepEqual(
      Object.keys(present(full.result.compiled.metadataInputs)),
      kind === "PnP state" ? [".yarn/chosen/package.json"] : ["package.json"],
    );
    assert.equal(
      marked.result.compiled.reuseEvidence.inputs[
        path.join(
          fixture.root,
          kind === "PnP state" ? ".pnp.cjs" : "other/value/package.json",
        )
      ]?.kind,
      "file",
    );
    assert.match(full.result.compiled.code, /original-index/);
    assert.match(marked.result.compiled.code, /original-index/);
  });
