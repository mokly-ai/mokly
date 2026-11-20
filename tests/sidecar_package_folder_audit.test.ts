import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { pnpFolder } from "./helpers/pnp_folder.js";

function markedRowBytes(file: string): number {
  return 2 * Buffer.byteLength(JSON.stringify(file)) + 128;
}

test("full PnP capture keeps reuse when its record fits beyond the marked reservation", async (context) => {
  const fixture = await pnpFolder(context, "json");
  const pkg = path.join(fixture.root, ".yarn/chosen");
  const limit = 8 * 1024 * 1024;
  const targets = ["./lib/value/"];
  let markedBytes = [
    pkg,
    path.join(pkg, "lib"),
    path.join(pkg, "lib/value"),
    path.join(pkg, "lib/value/package.json"),
  ].reduce((bytes, file) => bytes + markedRowBytes(file), 0);
  for (let index = 0; markedBytes <= limit && index < 20_000; index++) {
    const target = `./t${index}/`;
    targets.push(target);
    const base = path.resolve(pkg, target);
    markedBytes +=
      markedRowBytes(base) + markedRowBytes(path.join(base, "package.json"));
  }
  assert.ok(
    markedBytes > limit,
    "the bounded fixture exceeds the marked reservation",
  );
  const manifest = JSON.stringify({
    name: "chosen",
    exports: { "./sub/": targets },
  });
  assert.ok(Buffer.byteLength(manifest) < 1024 * 1024);
  await write(path.join(pkg, "package.json"), manifest);
  await write(
    path.join(fixture.root, "entry.mjs"),
    'export {value} from "chosen/sub/";',
  );
  const first = await bundle(fixture.params, build);
  assert.match(first.result.compiled.code, /original-index/);
  const evidence = first.result.compiled.reuseEvidence;
  assert.equal(evidence.complete, true);
  assert.ok(Buffer.byteLength(JSON.stringify(evidence)) < limit);
  await fixture.unrelated();
  assert.equal(
    (await reuse([first.generation], fixture.params))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
});
