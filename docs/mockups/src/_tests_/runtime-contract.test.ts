import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import config from "../../../../mokly.config.json";

const root = resolve(import.meta.dirname, "../../../..");

/**
 * The exact release of `@mokly/mokly`, `@mokly/viewer` and `@mokly/ui`, which
 * share one version and depend on each other's exact release.
 */
const moklyRelease = "0.19.0";
const json = (path: string) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));

function pinViolations(
  dependencies: Record<string, string>,
  required: Record<string, string>,
): string[] {
  return Object.entries(required).flatMap(([name, version]) =>
    dependencies[name] === version && /^\d+\.\d+\.\d+$/.test(version)
      ? []
      : [name + " needs the exact documented release"],
  );
}

test("the documented Firna peers are exact, installed and locked", () => {
  const protocol = readFileSync(
    resolve(root, "docs/protocol/cloud/shared-controls.md"),
    "utf8",
  );
  const required: Record<string, string> = { "@mokly/mokly": moklyRelease };
  for (const [, packages, version] of protocol.matchAll(
    /\| (`[^`]+`(?:, `[^`]+`)*)\s*\| `(\d+\.\d+\.\d+)`/g,
  ))
    for (const [, name] of packages.matchAll(/`([^`]+)`/g))
      required[name] = version;
  assert.equal(Object.keys(required).length, 15);
  const dependencies = json("apps/mockups/package.json").devDependencies;
  assert.deepEqual(pinViolations(dependencies, required), []);
  assert.ok(
    pinViolations({ ...dependencies, "@firna/ui": "^4.0.0" }, required).length,
  );
  assert.ok(
    pinViolations({ ...dependencies, "react-native-web": "0.20.0" }, required)
      .length,
  );
  const lock = json("package-lock.json");
  for (const [name, version] of Object.entries(required)) {
    assert.equal(
      json("node_modules/" + name + "/package.json").version,
      version,
    );
    assert.equal(lock.packages["node_modules/" + name].version, version);
  }
  for (const name of ["react", "react-dom"]) {
    assert.equal(json("package.json").devDependencies[name], required[name]);
    assert.deepEqual(
      Object.keys(lock.packages).filter((path) =>
        path.endsWith("node_modules/" + name),
      ),
      ["node_modules/" + name],
    );
  }
});

test("Firna uses one exact published release across the app, catalogue and tokens", () => {
  const release = "4.0.0";
  const lock = json("package-lock.json");
  for (const [workspace, section] of [
    ["app", "dependencies"],
    ["mockups", "devDependencies"],
    ["tokens", "dependencies"],
  ]) {
    assert.equal(
      json("ts/" + workspace + "/package.json")[section]["@firna/ui"],
      release,
    );
    assert.equal(lock.packages[workspace][section]["@firna/ui"], release);
  }
  assert.equal(lock.packages["node_modules/@firna/ui"].version, release);
  assert.match(
    lock.packages["node_modules/@firna/ui"].resolved,
    /\/ui-4\.0\.0\.tgz$/,
  );
  assert.deepEqual(
    Object.keys(lock.packages).filter((path) =>
      path.endsWith("node_modules/@firna/ui"),
    ),
    ["node_modules/@firna/ui"],
  );
});

test("Mokly uses the exact published guide-bearing release", () => {
  const release = moklyRelease;
  const lock = json("package-lock.json");

  assert.equal(json("package.json").devDependencies["@mokly/mokly"], release);
  assert.equal(lock.packages[""].devDependencies["@mokly/mokly"], release);
  assert.equal(lock.packages["node_modules/@mokly/mokly"].version, release);
  assert.match(
    lock.packages["node_modules/@mokly/mokly"].resolved,
    new RegExp("/mokly-" + release.replaceAll(".", "\\.") + "\\.tgz$"),
  );
  assert.equal(json("node_modules/@mokly/mokly/package.json").version, release);
  assert.ok(
    existsSync(
      resolve(root, "node_modules/@mokly/mokly/docs/guides/start/install.md"),
    ),
  );
  assert.ok(
    existsSync(
      resolve(root, "node_modules/@mokly/mokly/docs/protocol/mokly-guides.md"),
    ),
  );
  assert.ok(!("generatedOutput" in config));
  assert.deepEqual(config.roots, [
    { dir: "docs/mockups/src/entries", files: ["**/*.mockup.{ts,tsx}"] },
  ]);
});

test("Viewer uses one exact published release", () => {
  const release = moklyRelease;
  const lock = json("package-lock.json");

  assert.equal(
    json("apps/app/package.json").dependencies["@mokly/viewer"],
    release,
  );
  assert.equal(
    json("apps/mockups/package.json").devDependencies["@mokly/viewer"],
    release,
  );
  assert.equal(
    json("node_modules/@mokly/mokly/package.json").dependencies[
      "@mokly/viewer"
    ],
    release,
  );
  assert.equal(lock.packages["node_modules/@mokly/viewer"].version, release);
  assert.match(
    lock.packages["node_modules/@mokly/viewer"].resolved,
    new RegExp("/viewer-" + release.replaceAll(".", "\\.") + "\\.tgz$"),
  );
  assert.equal(
    json("node_modules/@mokly/viewer/package.json").version,
    release,
  );
  assert.deepEqual(
    Object.keys(lock.packages).filter((path) =>
      path.endsWith("node_modules/@mokly/viewer"),
    ),
    ["node_modules/@mokly/viewer"],
  );
});

test("Mokly UI uses the shared exact release where the catalogue imports it", () => {
  const release = moklyRelease;
  const lock = json("package-lock.json");

  assert.equal(
    json("apps/mockups/package.json").devDependencies["@mokly/ui"],
    release,
  );
  assert.equal(lock.packages.mockups.devDependencies["@mokly/ui"], release);
  assert.equal(
    json("node_modules/@mokly/viewer/package.json").dependencies["@mokly/ui"],
    release,
  );
  assert.equal(lock.packages["node_modules/@mokly/ui"].version, release);
  assert.match(
    lock.packages["node_modules/@mokly/ui"].resolved,
    new RegExp("/ui-" + release.replaceAll(".", "\\.") + "\\.tgz$"),
  );
  assert.equal(json("node_modules/@mokly/ui/package.json").version, release);
  assert.deepEqual(
    Object.keys(lock.packages).filter((path) =>
      path.endsWith("node_modules/@mokly/ui"),
    ),
    ["node_modules/@mokly/ui"],
  );
});

test("Mokly and test loaders preserve the public web resolution boundary", () => {
  assert.deepEqual(config.moduleResolution, {
    aliases: { "react-native": "react-native-web" },
    conditions: ["react-native", "import", "module", "default"],
    loaders: { ".js": "jsx" },
    mainFields: ["react-native", "module", "main"],
    packageRoots: ["ts"],
    resolveExtensions: [
      ".web.tsx",
      ".web.ts",
      ".web.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".json",
    ],
  });
  const types = json("apps/mockups/tsconfig.json").compilerOptions.paths;
  const runtime = json("apps/mockups/tsconfig.runtime.json").compilerOptions
    .paths;
  const packageExports = json("node_modules/@firna/ui/package.json").exports;
  for (const name of [
    ".",
    "button",
    "input",
    "badge",
    "avatar",
    "status-dot",
    "typography",
    "theme",
  ]) {
    const pathKey =
      name === "."
        ? "@firna/ui"
        : name === "theme"
          ? "@firna/ui/theme"
          : "@firna/ui/*";
    for (const [paths, condition] of [
      [types, "types"],
      [runtime, "import"],
    ] as const) {
      const target = resolve(
        root,
        "apps/mockups",
        paths[pathKey][0].replace("*", name),
      );
      assert.equal(
        target,
        resolve(
          root,
          "node_modules/@firna/ui",
          packageExports[name === "." ? "." : "./" + name][condition],
        ),
      );
      assert.ok(existsSync(target));
    }
  }
  assert.deepEqual(runtime["react-native"], runtime["react-native-web"]);
  assert.ok(
    json("apps/mockups/package.json").scripts["test:policy"].includes(
      "--import ./src/_tests_/register-web.mjs",
    ),
  );
});
