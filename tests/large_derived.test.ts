import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { prepareDerivedToolchain } from "../scripts/large/toolchain.mjs";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("the derived large fixture archives inputs and ignores generated output and fixture metadata", async (t) => {
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
    [
      ".review/",
      ".mokly-cache/",
      "node_modules/",
      ".mokly-large-fixture.json",
      "mockups/mokly-generated/",
    ],
  );
  const lock = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package-lock.json"), "utf8"),
  );
  const calls: string[][] = [];
  let packCount = 0;
  await prepareDerivedToolchain(
    repositoryRoot,
    root,
    async (executable, argv, options) => {
      calls.push([executable, ...argv]);
      if (argv[0] === "pack") {
        const viewer = packCount++ === 1;
        assert.equal(
          options.cwd,
          viewer
            ? path.join(repositoryRoot, "packages/viewer")
            : repositoryRoot,
        );
        assert.ok(argv.includes("--ignore-scripts"));
        const filename = viewer ? "viewer-test.tgz" : "mokly-test.tgz";
        await fs.writeFile(
          path.join(root, "tooling", filename),
          viewer ? "archived viewer bytes" : "archived package bytes",
        );
        return { stdout: JSON.stringify([{ filename }]), stderr: "" };
      }
      assert.equal(options.cwd, root);
      const pkg = JSON.parse(
        await fs.readFile(path.join(root, "package.json"), "utf8"),
      );
      assert.equal(pkg.dependencies["@mokly/mokly"], "file:tooling/mokly.tgz");
      assert.equal(
        pkg.dependencies["@mokly/viewer"],
        "file:tooling/viewer.tgz",
      );
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
      assert.equal(
        await fs.readFile(path.join(root, "tooling/viewer.tgz"), "utf8"),
        "archived viewer bytes",
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
      ["npm", "pack"],
      ["npm", "install"],
      ["npm", "ci"],
    ],
  );
});
