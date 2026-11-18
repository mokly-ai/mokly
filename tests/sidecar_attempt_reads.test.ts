import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import nodeFs from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";

import {
  link,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

for (const finalAttempt of ["planned", "full"] as const) {
  test(`${finalAttempt} attempts reuse consumer bytes and exclude native-only CSS`, async (context) => {
    const root = await nativeRoot(context);
    const head = path.join(root, "head");
    const base = path.join(root, "base");
    const theme = "packages/theme/index.mjs";
    const nativeCss = "packages/theme/native-only.module.css";
    const lib = "node_modules/lib/index.mjs";
    const entry = (value: string) =>
      `import styles from "./shared.module.css";
export const className = styles.shared;
export { default as asset } from "./value.raw";
export { value } from "lib";
export const stamp = ${JSON.stringify(value)};`;
    const nativeSource = `import "./native-only.module.css";
${finalAttempt === "full" ? 'import "./missing-native-only.mjs";' : ""}
export const value = "native";`;
    const sources = new Map([
      [path.join(base, "entry.mjs"), entry("before")],
      [path.join(base, "value.raw"), "before"],
      [path.join(base, "shared.module.css"), ".shared { color: red; }"],
      [path.join(base, nativeCss), ".native { color: red; }"],
      [path.join(head, theme), nativeSource],
      [path.join(base, theme), 'export const value = "final";'],
      [path.join(head, lib), 'export { value } from "@app/theme";'],
    ]);
    for (const side of [head, base])
      await packageAt(
        path.join(side, "packages/theme"),
        "@app/theme",
        sources.get(path.join(side, theme))!,
      );
    await write(path.join(head, nativeCss), ".native { color: red; }");
    await link(
      path.join(head, "packages/theme"),
      path.join(head, "node_modules/@app/theme"),
    );
    await packageAt(
      path.join(head, "node_modules/lib"),
      "lib",
      sources.get(path.join(head, lib))!,
    );
    for (const [file, text] of sources) await write(file, text);
    const params = nativeParams(
      base,
      { repositoryRoots: [head] },
      {
        dependencyRoot: head,
        packageRoots: [head],
        loaders: { ".raw": "text" },
      },
    );
    const reads = new Map<string, number>();
    const count = (file: unknown) => {
      const name = String(file);
      if (sources.has(name)) reads.set(name, (reads.get(name) ?? 0) + 1);
    };
    const syncRead = nodeFs.readFileSync;
    context.mock.method(
      nodeFs,
      "readFileSync",
      (file: Parameters<typeof nodeFs.readFileSync>[0], ...args: unknown[]) => {
        count(file);
        return Reflect.apply(syncRead, nodeFs, [file, ...args]);
      },
    );
    const callbackRead = nodeFs.readFile;
    context.mock.method(
      nodeFs,
      "readFile",
      (file: Parameters<typeof nodeFs.readFile>[0], ...args: unknown[]) => {
        count(file);
        return Reflect.apply(callbackRead, nodeFs, [file, ...args]);
      },
    );
    const promiseRead = fs.readFile;
    context.mock.method(
      fs,
      "readFile",
      (file: Parameters<typeof fs.readFile>[0], ...args: unknown[]) => {
        count(file);
        return Reflect.apply(promiseRead, fs, [file, ...args]);
      },
    );
    let compilations = 0;
    let nativeFailures = 0;
    for (const [index, stage] of ["before", "after"].entries()) {
      const snapshot = new Map(sources);
      const bundled = await bundle(
        params,
        async (options) => {
          compilations += 1;
          try {
            return await build(options);
          } catch (error) {
            nativeFailures += 1;
            throw error;
          } finally {
            if (compilations % 2 === 1) {
              const next = stage === "before" ? "after" : "latest";
              sources.set(path.join(base, "entry.mjs"), entry(next));
              sources.set(path.join(base, "value.raw"), next);
              sources.set(
                path.join(base, "shared.module.css"),
                `.shared { color: ${next}; }`,
              );
              for (const [file, text] of sources) await write(file, text);
            }
          }
        },
        unmeasured,
        undefined,
        finalAttempt === "full" ? "serveEdit" : "full",
      );
      assert.equal(compilations, (index + 1) * 2);
      assert.equal(nativeFailures, finalAttempt === "full" ? index + 1 : 0);
      assert.deepEqual(
        [...reads].sort(),
        [...sources.keys()].map((file) => [file, index + 1]).sort(),
      );
      assert.deepEqual(bundled.result.compiled.cssModules, [
        "shared.module.css",
      ]);
      assert.deepEqual(
        [...bundled.generation.cssModules],
        ["shared.module.css"],
      );
      for (const module of bundled.result.modules) {
        const file = module.path.startsWith("node_modules/")
          ? path.join(head, module.path)
          : path.join(base, module.path);
        assert.equal(
          module.digest,
          createHash("sha256").update(snapshot.get(file)!).digest("hex"),
          module.path,
        );
      }
      assert.equal(
        bundled.result.compiled.sources["entry.mjs"],
        snapshot.get(path.join(base, "entry.mjs")),
      );
      bundled.generation.maps = { "shared.module.css": { shared: "scoped" } };
      const exports = evaluate(bundled.generation).entries["entry.mjs"]!;
      assert.equal(exports.stamp, stage);
      assert.equal(exports.asset, stage);
      assert.equal(exports.value, "final");
      assert.equal(exports.className, "scoped");
    }
  });
}
