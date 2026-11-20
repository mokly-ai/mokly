import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

import ts from "typescript";

const root = resolve(import.meta.dirname, "../../../..");
const json = (path: string) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));

interface Manifest {
  name?: string;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
interface Lockfile {
  packages: Record<
    string,
    { name?: string; version?: string; resolved?: string; link?: boolean }
  >;
}

const lock: Lockfile = json("package-lock.json");

/** The root manifest and each npm workspace manifest, by directory. */
function manifests(): [string, Manifest][] {
  const workspace: Manifest = json("package.json");
  return [
    [".", workspace],
    ...(workspace.workspaces ?? []).map((directory): [string, Manifest] => [
      directory,
      json(join(directory, "package.json")),
    ]),
  ];
}

/** Each declared range of `name`, with the directory that declares it. */
function declarations(name: string): [string, string][] {
  return manifests().flatMap(([directory, manifest]) =>
    [manifest.dependencies, manifest.devDependencies].flatMap((section) =>
      section?.[name] === undefined
        ? []
        : [[directory, section[name]] as [string, string]],
    ),
  );
}

/** Each lockfile install path of `name`, at the root or nested. */
function installs(name: string): string[] {
  return Object.keys(lock.packages).filter(
    (path) =>
      path === "node_modules/" + name || path.endsWith("/node_modules/" + name),
  );
}

/** The `paths` target of `specifier`, matched as TypeScript and tsx match it. */
function mappedPath(paths: Record<string, string[]>, specifier: string) {
  const exact = paths[specifier]?.[0];
  if (exact !== undefined) return exact;
  const [pattern] = Object.keys(paths)
    .filter((key) => {
      const [prefix, suffix, ...rest] = key.split("*");
      return (
        suffix !== undefined &&
        rest.length === 0 &&
        specifier.length >= prefix.length + suffix.length &&
        specifier.startsWith(prefix) &&
        specifier.endsWith(suffix)
      );
    })
    .sort((left, right) => right.indexOf("*") - left.indexOf("*"));
  assert.ok(pattern, specifier + " has no TypeScript path");
  const [prefix, suffix] = pattern.split("*");
  const captured = specifier.slice(
    prefix.length,
    specifier.length - suffix.length,
  );
  return paths[pattern][0].replace("*", captured);
}

/** Each `@firna/ui` specifier that a catalogue source or test imports. */
function firnaImports(): Set<string> {
  const sources = resolve(root, "docs/mockups/src");
  const specifiers = readdirSync(sources, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(?:ts|tsx|mjs)$/.test(file))
    .flatMap((file) =>
      ts
        .preProcessFile(readFileSync(join(sources, file), "utf8"), true, true)
        .importedFiles.map(({ fileName }) => fileName),
    );
  return new Set(
    specifiers.filter(
      (specifier) =>
        specifier === "@firna/ui" || specifier.startsWith("@firna/ui/"),
    ),
  );
}

test("every Mokly package installs once, as its workspace package", () => {
  // The lockfile's local entries are the repository's own package directories.
  const sources = new Map(
    Object.entries(lock.packages)
      .filter(([path]) => path !== "" && !path.includes("node_modules/"))
      .map(([path, entry]) => [entry.name, path]),
  );
  const cloudUses = new Set(
    manifests()
      .filter(([, manifest]) => manifest.name?.startsWith("@mokly-cloud/"))
      .flatMap(([, manifest]) => [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.devDependencies ?? {}),
      ])
      .filter((name) => name.startsWith("@mokly/")),
  );
  assert.ok(cloudUses.has("@mokly/viewer"));
  const locked = Object.keys(lock.packages)
    .filter((path) => /(^|\/)node_modules\/@mokly\//.test(path))
    .map((path) => path.slice(path.lastIndexOf("node_modules/") + 13));
  for (const name of new Set([...cloudUses, ...locked])) {
    assert.deepEqual(installs(name), ["node_modules/" + name], name);
    const entry = lock.packages["node_modules/" + name];
    assert.deepEqual(
      { link: entry.link, resolved: entry.resolved },
      { link: true, resolved: sources.get(name) },
      name,
    );
  }
  for (const name of cloudUses)
    assert.equal(
      realpathSync(resolve(root, "node_modules", name)),
      resolve(root, sources.get(name) ?? "missing"),
      name,
    );
});

test("every workspace declares one exact @firna/ui release, installed once", () => {
  const declared = declarations("@firna/ui");
  const versions = [...new Set(declared.map(([, range]) => range))];
  assert.equal(versions.length, 1, JSON.stringify(declared));
  const [version] = versions;
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(installs("@firna/ui"), ["node_modules/@firna/ui"]);
  assert.equal(lock.packages["node_modules/@firna/ui"].version, version);
  assert.equal(json("node_modules/@firna/ui/package.json").version, version);
});

test("React and React DOM install once, at one version", () => {
  const version = lock.packages["node_modules/react"].version;
  for (const name of ["react", "react-dom"]) {
    assert.deepEqual(installs(name), ["node_modules/" + name], name);
    assert.equal(lock.packages["node_modules/" + name].version, version, name);
    assert.equal(json(`node_modules/${name}/package.json`).version, version);
  }
});

test("the catalogue's Firna paths name the package's public export targets", () => {
  const specifiers = firnaImports();
  assert.ok(specifiers.has("@firna/ui/theme"));
  const exports = json("node_modules/@firna/ui/package.json").exports;
  for (const [config, condition] of [
    ["apps/mockups/tsconfig.json", "types"],
    ["apps/mockups/tsconfig.runtime.json", "import"],
  ]) {
    const paths = json(config).compilerOptions.paths;
    for (const specifier of specifiers) {
      const subpath = "." + specifier.slice("@firna/ui".length);
      const target = resolve(
        root,
        "apps/mockups",
        mappedPath(paths, specifier),
      );
      const exported = exports[subpath]?.[condition];
      assert.ok(exported, `${specifier} exports a ${condition} target`);
      assert.equal(
        target,
        resolve(root, "node_modules/@firna/ui", exported),
        `${config} ${specifier}`,
      );
      assert.ok(existsSync(target), target);
    }
  }
});
