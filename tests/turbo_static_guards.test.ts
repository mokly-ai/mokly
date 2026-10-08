import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./helpers/fixture.js";
import { directBaselineCommands } from "./helpers/turbo_baseline.js";

interface PackageMetadata {
  name: string;
  scripts: Record<string, string>;
}

async function readJson(relative: string) {
  return JSON.parse(
    await fs.readFile(path.join(repositoryRoot, relative), "utf8"),
  );
}

test("direct baseline commands and their npm scripts never invoke Turbo", async () => {
  const root = (await readJson("package.json")) as PackageMetadata;
  const viewer = (await readJson(
    "packages/viewer/package.json",
  )) as PackageMetadata;
  const workspaces = new Map([
    [root.name, root],
    [viewer.name, viewer],
    ["packages/viewer", viewer],
    ["./packages/viewer", viewer],
  ]);
  const active = new Set<string>();
  const checkScript = (name: string, metadata: PackageMetadata) => {
    const key = `${metadata.name}#${name}`;
    assert.ok(!active.has(key), `Recursive baseline script: ${key}`);
    const script = metadata.scripts[name];
    assert.equal(typeof script, "string", `Missing baseline script: ${key}`);
    active.add(key);
    for (const command of script!.split(/&&|\|\||[;|]/u))
      checkCommand(
        command
          .trim()
          .split(/\s+/u)
          .map((arg) => arg.replace(/^['"]|['"]$/gu, "")),
        metadata,
      );
    active.delete(key);
  };
  const checkCommand = (
    command: readonly string[],
    metadata: PackageMetadata,
  ) => {
    assert.doesNotMatch(command.join(" "), /\bturbo\b/iu);
    const npm = command.indexOf("npm");
    if (npm === -1) return;
    const positional: string[] = [];
    let workspace: string | undefined;
    for (let index = npm + 1; index < command.length; index++) {
      const arg = command[index]!;
      if (arg === "--workspace" || arg === "-w") workspace = command[++index];
      else if (/^(?:--workspace|-w)=/u.test(arg))
        workspace = arg.slice(arg.indexOf("=") + 1);
      else if (!arg.startsWith("-")) positional.push(arg);
    }
    const target = workspace ? workspaces.get(workspace) : metadata;
    assert.ok(target, `Unknown baseline workspace: ${workspace}`);
    if (positional[0] === "ci") {
      for (const hook of [
        "preinstall",
        "install",
        "postinstall",
        "prepublish",
        "preprepare",
        "prepare",
        "postprepare",
      ])
        if (target.scripts[hook]) checkScript(hook, target);
    } else if (positional[0] === "run" || positional[0] === "run-script") {
      const name = positional[1];
      assert.ok(name, "Baseline npm run needs a script name");
      for (const script of [`pre${name}`, name, `post${name}`])
        if (script === name || target.scripts[script])
          checkScript(script, target);
    }
  };
  for (const command of directBaselineCommands) checkCommand(command, root);
});

test("package builds and root prepack begin with their clean step", async () => {
  const root = (await readJson("package.json")) as PackageMetadata;
  const viewer = (await readJson(
    "packages/viewer/package.json",
  )) as PackageMetadata;
  assert.equal(root.scripts.build, "turbo run build:package 1>&2");
  assert.equal(root.scripts["prepare:verification"], "turbo run example:build");
  for (const [metadata, script, prefix] of [
    [
      root,
      "build:package",
      "node scripts/clean.mjs --package @mokly/mokly && ",
    ],
    [root, "prepack", "node scripts/clean.mjs && "],
    [
      viewer,
      "build",
      "node ../../scripts/clean.mjs --package @mokly/viewer && ",
    ],
  ] as const)
    assert.ok(metadata.scripts[script]?.startsWith(prefix), script);
});

test("both TypeScript builds exclude their ignored output directories", async () => {
  for (const file of [
    "tsconfig.build.json",
    "packages/viewer/tsconfig.build.json",
  ]) {
    const config = (await readJson(file)) as { exclude: string[] };
    for (const directory of [
      "node_modules",
      "dist",
      "target",
      "coverage",
      "test-results",
      "playwright-report",
    ])
      assert.ok(
        config.exclude.includes(`**/${directory}/**`),
        `${file}: ${directory}`,
      );
  }
});

test("viewer source assets omit ignored paths and archives but keep authored assets", async () => {
  const { isSourceAsset } = (await import(
    pathToFileURL(
      path.join(repositoryRoot, "packages/viewer/scripts/source_files.mjs"),
    ).href
  )) as { isSourceAsset(relative: string): boolean };
  for (const directory of [
    ".context",
    ".mokly-cache",
    ".wrangler",
    ".turbo",
    ".superpowers",
    "coverage",
    "dist",
    "node_modules",
    "target",
    "test-results",
    "playwright-report",
    ".mokly-write-old",
    ".mokly-review-old",
  ])
    for (const prefix of ["", "icons"])
      assert.equal(
        isSourceAsset(path.join(prefix, directory, "logo.svg")),
        false,
        directory,
      );
  assert.equal(isSourceAsset("archive.tgz"), false);
  assert.equal(
    isSourceAsset(path.join("icons", "archive.tgz", "logo.svg")),
    false,
  );
  assert.equal(isSourceAsset(path.join("icons", "authored-logo.svg")), true);
});
