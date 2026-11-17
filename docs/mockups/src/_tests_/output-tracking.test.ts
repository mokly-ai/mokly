import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { fixtureGitEnvironment } from "../../../../apps/mockups/src/_tests_/git-environment.mjs";
import {
  indexPath,
  outputRoot,
  screenView,
  stylesheetPath,
} from "./catalogue-paths";
import {
  outputDirectory,
  repository,
  sha256,
} from "./generated-output-fixture";
import {
  assertNoTrackedGeneratedOutput,
  reservationDirectory,
} from "./generated-output-policy";
import { policyFixture } from "./policy-fixture";

const output = outputDirectory + "/";
const reservations = reservationDirectory + "/";
const legacy = "docs/mockups/" + GENERATED_DIRECTORY + "/";
const smoke =
  "scripts/cloud/fixtures/publication-smoke-v0.14/catalogue/" +
  GENERATED_DIRECTORY +
  "/";

/**
 * Each root ignore rule and the paths that it must cover. The first path of
 * each rule is covered by that rule alone.
 */
const probes = [
  {
    rule: "/" + output,
    paths: [
      output + indexPath,
      output + screenView("product/account/project-created", "desktop"),
      output + stylesheetPath("docs/mockups/styles/base.css"),
      output + ".mokly-export-artifact",
    ],
  },
  {
    rule: reservations,
    paths: [
      reservations + ".owner",
      reservations + "locks/" + outputDirectory,
      "docs/mockups/" + reservations + ".owner",
    ],
  },
  {
    rule: GENERATED_DIRECTORY + "/",
    paths: [
      legacy + "mokly-manifest.json",
      legacy + "product/account/project-created/index.desktop.html",
      smoke + "mokly-manifest.json",
      smoke + "publication-smoke/index.mobile.html",
      smoke + "publication-smoke/index.desktop.html",
    ],
  },
] as const;
const prettier = path.join(repository, "node_modules/.bin/prettier");

/** The ignore file without one rule line, which must be present. */
function withoutRule(ignore: string, rule: string): string {
  const lines = ignore.split("\n");
  const kept = lines.filter((line) => line !== rule);
  assert.equal(kept.length, lines.length - 1, rule);
  return kept.join("\n");
}

/** The rule that `git check-ignore -v` reports for one path, or none. */
function ignoringRule(cwd: string, file: string): string | undefined {
  const result = spawnSync(
    "git",
    ["check-ignore", "--no-index", "-v", "--", file],
    { cwd, encoding: "utf8", env: fixtureGitEnvironment() },
  );
  return /^\.gitignore:\d+:([^\t]*)\t/.exec(result.stdout)?.[1];
}

test("the repository tracks no generated output at any depth", () => {
  assertNoTrackedGeneratedOutput(repository);
});

test("the built dogfood font preserves the exact authored bytes", async () => {
  const sheet = stylesheetPath("docs/mockups/styles/base.css");
  const css = await readFile(path.join(outputRoot, sheet), "utf8");
  const fonts = [
    ...css.matchAll(/url\(["']?([^\s)"']*InterVariable\.woff2)["']?\)/g),
  ];
  assert.equal(fonts.length, 1);
  assert.equal(
    sha256(
      await readFile(
        path.resolve(outputRoot, path.dirname(sheet), fonts[0][1]),
      ),
    ),
    sha256(
      await readFile(
        path.join(repository, "docs/mockups/styles/fonts/InterVariable.woff2"),
      ),
    ),
  );
});

test("one indexed generated file fails the tracking guard", async (t) => {
  const fixture = await policyFixture();
  t.after(fixture.cleanup);
  for (const file of [
    output + "partial.html",
    reservations + "locks/partial",
    "src/nested/" + reservations + "partial",
    GENERATED_DIRECTORY + "/partial.html",
    "src/nested/" + GENERATED_DIRECTORY + "/partial.json",
  ]) {
    await fixture.write(file, "Generated fixture\n");
    fixture.git("add", "--", file);
    assert.throws(
      () => assertNoTrackedGeneratedOutput(fixture.root),
      /Git tracks generated mockup output/,
    );
    fixture.git("rm", "--cached", "--", file);
  }
  fixture.git("add", ".");
  assert.throws(() => assertNoTrackedGeneratedOutput(fixture.root), /partial/);
});

test("output, reservation and earlier output directories are ignored when present and absent", async (t) => {
  const fixture = await policyFixture();
  t.after(fixture.cleanup);
  const ignore = await readFile(path.join(repository, ".gitignore"), "utf8");
  await fixture.write(".gitignore", ignore);
  for (const { rule, paths } of probes)
    for (const file of paths)
      assert.equal(ignoringRule(repository, file), rule, file);
  for (const present of [false, true]) {
    for (const { rule, paths } of probes) {
      for (const file of paths) {
        if (present) await fixture.write(file, "Fixture\n");
        assert.equal(ignoringRule(fixture.root, file), rule, file);
      }
    }
  }
  for (const { rule, paths } of probes) {
    await fixture.write(".gitignore", withoutRule(ignore, rule));
    assert.equal(ignoringRule(fixture.root, paths[0]), undefined, rule);
  }
});

test("Prettier ignores output and baseline metadata from the root rules", async (t) => {
  const fixture = await policyFixture();
  t.after(fixture.cleanup);
  const ignore = await readFile(path.join(repository, ".gitignore"), "utf8");
  await fixture.write(".gitignore", ignore);
  const cache = ".mokly-cache/baselines/" + "0".repeat(40) + "/";
  for (const file of [
    cache + "complete.json",
    cache + "inputs.json",
    ...probes.flatMap(({ paths }) => paths),
  ]) {
    await fixture.write(file, "{}\n");
    const info = JSON.parse(
      execFileSync(prettier, ["--file-info", file], {
        cwd: fixture.root,
        encoding: "utf8",
      }),
    );
    assert.equal(info.ignored, true, file);
  }
  await fixture.write(".mokly-cache/.gitignore", "*\n");
  await fixture.write(".gitignore", withoutRule(ignore, ".mokly-cache/"));
  const info = JSON.parse(
    execFileSync(prettier, ["--file-info", cache + "complete.json"], {
      cwd: fixture.root,
      encoding: "utf8",
    }),
  );
  assert.equal(
    info.ignored,
    false,
    "a nested cache ignore is insufficient for Prettier",
  );
  const formatting = await readFile(
    path.join(repository, ".prettierignore"),
    "utf8",
  );
  assert.ok(formatting.split("\n").includes("**/" + GENERATED_DIRECTORY + "/"));
  await rm(path.join(fixture.root, ".mokly-cache/.gitignore"));
});
