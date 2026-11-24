import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import test from "node:test";

import desktop from "../../package.json" with { type: "json" };
import { buildRecordFilename } from "../../scripts/release-build-record.mjs";

test("release-build starts fresh and records the names, sizes and SHA-256 hashes without a GitHub token", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "mokly-release-build-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packageDirectory = join(root, "packages", "desktop");
  const output = join(packageDirectory, "release");
  const build = join(output, "build");
  const binaries = join(root, "node_modules", ".bin");
  await mkdir(build, { recursive: true });
  await mkdir(binaries, { recursive: true });
  await cp(
    new URL("../../scripts", import.meta.url),
    join(packageDirectory, "scripts"),
    {
      recursive: true,
    },
  );
  await cp(
    new URL("../../package.json", import.meta.url),
    join(packageDirectory, "package.json"),
  );
  await writeFile(join(build, "stale.zip"), "previous attempt");
  await writeFile(
    join(binaries, "electron-builder"),
    `#!/usr/bin/env node
const assert = require("node:assert/strict");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const args = process.argv.slice(2);
assert.equal(args[args.indexOf("--publish") + 1], "never");
assert.equal(process.env.GH_TOKEN, undefined);
const prefix = "--config.directories.output=";
const output = args.find((arg) => arg.startsWith(prefix)).slice(prefix.length);
writeFileSync(join(output, "Mokly-fixture.zip"), "abc");
writeFileSync(join(output, "latest-fixture.yml"), "hello world");
`,
    { mode: 0o700 },
  );
  const result = spawnSync(
    process.execPath,
    [join(packageDirectory, "scripts", "package.mjs"), "release-build"],
    {
      encoding: "utf8",
      env: {
        PATH: [dirname(process.execPath), process.env.PATH]
          .filter(Boolean)
          .join(delimiter),
        CSC_LINK: Buffer.from("certificate fixture").toString("base64"),
        APPLE_API_KEY: "key fixture",
      },
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const record: unknown = JSON.parse(
    await readFile(join(output, buildRecordFilename), "utf8"),
  );
  assert.deepEqual(record, {
    tag: `v${desktop.version}`,
    platform: process.platform === "darwin" ? "macos" : "linux",
    assets: [
      {
        name: "Mokly-fixture.zip",
        size: 3,
        sha256:
          "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      },
      {
        name: "latest-fixture.yml",
        size: 11,
        sha256:
          "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      },
    ],
  });
  assert.equal(await readFile(join(build, "Mokly-fixture.zip"), "utf8"), "abc");
});
