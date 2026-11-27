import assert from "node:assert/strict";
import fs from "node:fs";
import nodeModule from "node:module";
import path from "node:path";
import test from "node:test";

import { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";
import { postcssRequireTarget } from "../packages/mokly/src/sidecar/postcss-require-target.js";

import { cssParams } from "./helpers/sidecar.js";

test("a Windows PostCSS require keeps its written link and canonical target", (context) => {
  const win = path.win32;
  const root = String.raw`C:\Users\runneradmin\Temp\catalogue`;
  const tracked = win.join(root, "tracked", "real.cjs");
  const written = win.join(root, "generated", "link.cjs");
  const short = String.raw`C:\Users\RUNNER~1\Temp\catalogue\tracked\real.cjs`;
  const extended = win.toNamespacedPath(tracked);
  const canonical = new Map([
    [written, tracked],
    [short, tracked],
    [extended, tracked],
  ]);
  const native = nodeModule.createRequire(import.meta.url);
  let selected = short;
  context.mock.method(native, "resolve", () => selected);
  context.mock.method(nodeModule, "createRequire", () => native);
  context.mock.method(fs, "realpathSync", (file: fs.PathLike) => String(file));
  context.mock.method(fs.realpathSync, "native", (file: fs.PathLike) => {
    const name = String(file);
    return canonical.get(name) ?? name;
  });
  for (const method of [
    "basename",
    "dirname",
    "isAbsolute",
    "join",
    "relative",
    "resolve",
  ] as const)
    context.mock.method(path, method, win[method]);
  const separator = path.sep;
  Object.assign(path, { sep: win.sep });
  nodeModule.syncBuiltinESMExports();
  context.after(() => {
    context.mock.restoreAll();
    Object.assign(path, { sep: separator });
    nodeModule.syncBuiltinESMExports();
  });

  const paths = ModulePaths.createSync({
    sourceRoot: root,
    repositoryRoots: [],
    moduleResolution: { ...cssParams().moduleResolution, packageRoots: [] },
  });
  const configuration = win.join(root, "postcss.mjs");
  for (const name of [short, extended]) {
    selected = name;
    assert.deepEqual(
      postcssRequireTarget(
        paths,
        "./generated/link.cjs",
        configuration,
        undefined,
        true,
      ),
      { file: tracked, named: written },
      name,
    );
  }
});
