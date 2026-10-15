import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");

async function sources(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? sources(full) : Promise.resolve([full]);
    }),
  );
  return files.flat().filter((file) => /\.tsx?$/.test(file));
}

test("the package's public entries are the root, browser, data and styles", async () => {
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  ) as { exports: Record<string, unknown>; sideEffects: string[] };
  assert.deepEqual(Object.keys(manifest.exports), [
    ".",
    "./browser",
    "./data",
    "./styles.css",
  ]);
  assert.deepEqual(manifest.exports["./browser"], {
    types: "./dist/browser.d.ts",
    import: "./dist/browser.js",
  });
  assert.ok(manifest.sideEffects.includes("./dist/browser.js"));
});

test("React entry bundles for browsers without CLI, server or Node code", async () => {
  const result = await build({
    entryPoints: [path.join(root, "src/index.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    metafile: true,
    logLevel: "silent",
  });
  for (const input of Object.keys(result.metafile.inputs))
    assert.doesNotMatch(input, /(?:^|\/)src\/(?:cli|server|build)\//);
});

test("the shell renders on the client and nothing hydrates server markup", async () => {
  const entry = await fs.readFile(path.join(root, "src/browser.tsx"), "utf8");
  assert.match(entry, /from "react-dom\/client"/);
  assert.match(entry, /createRoot\(/);
  for (const file of await sources(path.join(root, "src")))
    assert.doesNotMatch(
      await fs.readFile(file, "utf8"),
      /hydrateRoot|react-dom\/server/,
      path.relative(root, file),
    );
});

test("the browser bundles are the standalone shell and the frame inspector", async () => {
  const directory = path.join(root, "dist/browser");
  assert.deepEqual((await fs.readdir(directory)).sort(), [
    "inspector.js",
    "shell.js",
  ]);
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(root, "dist/browser.manifest.json"), "utf8"),
    ),
    { schemaVersion: 1, modules: ["inspector.js", "shell.js"] },
  );
  const shell = await fs.readFile(path.join(directory, "shell.js"), "utf8");
  assert.match(shell, /createRoot/);
  assert.doesNotMatch(shell, /from\s*["'](?:node:|react|react-dom)/);
  const inspector = await fs.readFile(
    path.join(directory, "inspector.js"),
    "utf8",
  );
  assert.doesNotMatch(
    inspector,
    /from\s*["']node:|react-dom|createRoot|react\.production/,
  );
});

test("the removed server and runtime entries cannot be imported", async () => {
  for (const specifier of ["@mokly/viewer/server", "@mokly/viewer/runtime"])
    await assert.rejects(
      build({
        stdin: {
          contents: `import * as entry from "${specifier}"; console.log(entry);`,
          resolveDir: root,
        },
        bundle: true,
        write: false,
        platform: "browser",
        logLevel: "silent",
      }),
      specifier,
    );
});
