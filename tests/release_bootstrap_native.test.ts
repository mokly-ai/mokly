import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createBootstrapArchive } from "../scripts/release/bootstrap_archive.mjs";
import { packNative } from "../scripts/release/native.mjs";
import { inspectPackedManifest } from "../scripts/release/packed_manifest.mjs";
import { NATIVE_TARGETS } from "../scripts/release/targets.mjs";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

async function nativeFixture(t: test.TestContext) {
  const fixture = await bootstrapFixture(t);
  const target = NATIVE_TARGETS.find(
    ({ os, cpu }) => os === process.platform && cpu === process.arch,
  )!;
  for (const directory of ["packages/mokly", target.directory]) {
    await fs.mkdir(path.join(fixture.root, directory), { recursive: true });
    await fs.copyFile(
      path.join(repositoryRoot, directory, "package.json"),
      path.join(fixture.root, directory, "package.json"),
    );
  }
  for (const file of ["LICENSE", "README.md"])
    await fs.copyFile(
      path.join(repositoryRoot, target.directory, file),
      path.join(fixture.root, target.directory, file),
    );
  await fs.appendFile(
    path.join(fixture.root, ".gitignore"),
    "packages/native-*/bin/\ntarget/\n",
  );
  await fixture.git("add", "-A");
  await fixture.git("commit", "-m", "test: native source");
  return {
    ...fixture,
    expectedCommit: await fixture.git("rev-parse", "HEAD"),
    target,
  };
}

test("native registration packs reserved version 0.0.0 from an isolated checked build and inspects dependencies", async (t) => {
  const fixture = await nativeFixture(t);
  const cli = JSON.parse(
    await fs.readFile(
      path.join(fixture.root, "packages/mokly/package.json"),
      "utf8",
    ),
  ) as { version: string };
  const events: string[] = [];
  const result = await createBootstrapArchive(
    {
      ...fixture,
      repositoryRoot: fixture.root,
      packageName: fixture.target.name,
    },
    {
      packNative: async (checkout, target, destination, binary, options) => {
        assert.notEqual(checkout, fixture.root);
        assert.equal(
          await fs.readFile(path.join(checkout, "source.txt"), "utf8"),
          "reviewed source\n",
        );
        assert.equal(options?.registration, true);
        return await packNative(checkout, target, destination, binary, {
          ...options,
          execute: async (file, args) => {
            events.push(file === "cargo" ? "build" : "version");
            if (file === "cargo") {
              assert.ok(args.includes("--locked"));
              const output = path.join(
                checkout,
                "target/release-native",
                fixture.target.triple,
                "release",
                fixture.target.executable,
              );
              await fs.mkdir(path.dirname(output), { recursive: true });
              await fs.writeFile(output, "synthetic registration fixture");
            }
            return { stdout: `${cli.version}\n`, stderr: "" };
          },
          inspect: async (binary, os) => {
            assert.equal(os, fixture.target.os);
            assert.equal(
              await fs.readFile(binary, "utf8"),
              "synthetic registration fixture",
            );
            events.push("inspect");
            return "fixture native dependency inspection\n";
          },
        });
      },
    },
  );
  assert.deepEqual(events, ["build", "version", "inspect"]);
  assert.equal(result.report.version, "0.0.0");
  assert.equal(result.report.binaryVersion, cli.version);
  assert.equal(result.report.sourceCommit, fixture.expectedCommit);
  assert.equal(
    (await inspectPackedManifest(result.archivePath, result.report)).version,
    "0.0.0",
  );
  assert.equal(
    await fs.readFile(
      path.join(fixture.destination, "tls-dependencies.txt"),
      "utf8",
    ),
    "fixture native dependency inspection\n",
  );
  assert.equal(await fixture.git("status", "--porcelain"), "");
});

test("native registration rejects a wrong host and source mutations during the build", async (t) => {
  const fixture = await nativeFixture(t);
  const other = NATIVE_TARGETS.find(({ os }) => os !== process.platform)!;
  await assert.rejects(
    createBootstrapArchive({
      ...fixture,
      repositoryRoot: fixture.root,
      packageName: other.name,
    }),
    /target OS/,
  );
  const metadata = JSON.parse(
    await fs.readFile(
      path.join(fixture.root, "packages/mokly/package.json"),
      "utf8",
    ),
  ) as { version: string };
  await assert.rejects(
    createBootstrapArchive(
      {
        ...fixture,
        repositoryRoot: fixture.root,
        packageName: fixture.target.name,
      },
      {
        packNative: async (checkout, target, destination, binary, options) => {
          const result = await packNative(
            checkout,
            target,
            destination,
            binary,
            {
              ...options,
              execute: async (file) => {
                if (file === "cargo") {
                  const output = path.join(
                    checkout,
                    "target/release-native",
                    fixture.target.triple,
                    "release",
                    fixture.target.executable,
                  );
                  await fs.mkdir(path.dirname(output), { recursive: true });
                  await fs.writeFile(output, "synthetic registration fixture");
                }
                return { stdout: `${metadata.version}\n`, stderr: "" };
              },
              inspect: async () => "fixture inspection",
            },
          );
          await fs.writeFile(path.join(checkout, "source.txt"), "unreviewed");
          return result;
        },
      },
    ),
    /clean.*source|source.*clean/,
  );
  await assert.rejects(fs.stat(fixture.destination), { code: "ENOENT" });
});
