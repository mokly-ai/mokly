import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { prepareDerivedToolchain } from "../scripts/large/toolchain.mjs";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("the derived large fixture archives install/build inputs and ignores only generated output", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-derived-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fixture = await generateLargeFixture(
    root,
    { areas: 1, screens: 2, rows: 1 },
    false,
  );
  const config = await loadConfig(root);
  assert.equal(fixture.trackedOutput, false);
  assert.deepEqual(config.review.baselineBuild, [
    ["npm", "ci"],
    ["npx", "--no-install", "mokly", "build", "--config", "mokly.config.ts"],
  ]);
  assert.deepEqual(
    (await fs.readFile(path.join(root, ".gitignore"), "utf8"))
      .trim()
      .split("\n"),
    [".review/", ".mokly-cache/", "node_modules/", "mockups/.generated/"],
  );
  const lock = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package-lock.json"), "utf8"),
  );
  const calls: string[][] = [];
  await prepareDerivedToolchain(
    repositoryRoot,
    root,
    async (executable, argv, options) => {
      calls.push([executable, ...argv]);
      if (argv[0] === "pack") {
        assert.equal(options.cwd, repositoryRoot);
        assert.ok(argv.includes("--ignore-scripts"));
        await fs.writeFile(
          path.join(root, "tooling", "mokly-test.tgz"),
          "archived package bytes",
        );
        return { stdout: '[{"filename":"mokly-test.tgz"}]', stderr: "" };
      }
      assert.equal(options.cwd, root);
      const pkg = JSON.parse(
        await fs.readFile(path.join(root, "package.json"), "utf8"),
      );
      assert.equal(pkg.dependencies["@mokly/mokly"], "file:tooling/mokly.tgz");
      assert.equal(
        pkg.dependencies["@firna/ui"],
        lock.packages["node_modules/@firna/ui"].version,
      );
      for (const peer of Object.keys(
        lock.packages["node_modules/@firna/ui"].peerDependencies,
      ))
        assert.equal(
          pkg.dependencies[peer],
          lock.packages[`node_modules/${peer}`].version,
        );
      assert.equal(
        await fs.readFile(path.join(root, "tooling/mokly.tgz"), "utf8"),
        "archived package bytes",
      );
      if (argv[0] === "install") {
        assert.ok(argv.includes("--package-lock-only"));
        await fs.writeFile(
          path.join(root, "package-lock.json"),
          '{"lockfileVersion":3}',
        );
      } else await fs.access(path.join(root, "package-lock.json"));
      return { stdout: "", stderr: "" };
    },
  );
  assert.deepEqual(
    calls.map((call) => call.slice(0, 2)),
    [
      ["npm", "pack"],
      ["npm", "install"],
      ["npm", "ci"],
    ],
  );
});
