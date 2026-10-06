import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { parseBaselineArchive } from "../packages/mokly/dist/baseline/archive.js";
import {
  baselineEnvironment,
  runBaselineCommands,
} from "../packages/mokly/dist/baseline/commands.js";
import { BaselineCommandError } from "../packages/mokly/dist/baseline/errors.js";

import {
  archive,
  baselineFixture,
  success,
} from "./helpers/baseline_fixture.js";

test("archive preserves regular bytes and confined symlinks", async () => {
  const entries = await parseBaselineArchive(
    archive([
      { path: "dir/", type: "Directory" },
      { path: "dir/file", content: "base content" },
      { path: "link", type: "SymbolicLink", linkpath: "dir/file" },
    ]),
  );
  assert.equal(entries[1]?.mode, 0o755);
  assert.equal(Buffer.from(entries[1]!.bytes).toString(), "base content");
  assert.equal(entries[2]?.target, "dir/file");
});

for (const entry of [
  { path: "../escaped", content: "bad" },
  { path: "/absolute", content: "bad" },
  { path: "link", type: "SymbolicLink" as const, linkpath: "../outside" },
  { path: "link", type: "SymbolicLink" as const, linkpath: "/outside" },
  { path: "link", type: "Link" as const, linkpath: "file" },
  { path: "pipe", type: "FIFO" as const },
])
  test(`archive rejects ${entry.type ?? "File"} ${entry.path} ${entry.linkpath ?? ""}`, async () => {
    await assert.rejects(parseBaselineArchive(archive([entry])));
  });

test("archive rejects writes through links and traversal after resolving a link", async () => {
  await assert.rejects(
    parseBaselineArchive(
      archive([
        { path: "link", type: "SymbolicLink", linkpath: "." },
        { path: "link/file", content: "bad" },
      ]),
    ),
    /non-directory ancestor/,
  );
  await assert.rejects(
    parseBaselineArchive(
      archive([
        { path: "dir", type: "SymbolicLink", linkpath: "." },
        { path: "link", type: "SymbolicLink", linkpath: "dir/../outside" },
      ]),
    ),
    /Outward/,
  );
  await assert.rejects(
    parseBaselineArchive(
      archive([
        { path: "a", type: "SymbolicLink", linkpath: "b" },
        { path: "b", type: "SymbolicLink", linkpath: "a" },
      ]),
    ),
    /Cyclic/,
  );
});

test("archive rejects corrupt, truncated, duplicate, and compressed input", async () => {
  const valid = archive([{ path: "file", content: "data" }]);
  const corrupt = Buffer.from(valid);
  corrupt[0] = 9;
  await assert.rejects(parseBaselineArchive(corrupt));
  await assert.rejects(parseBaselineArchive(valid.subarray(0, -512)));
  await assert.rejects(
    parseBaselineArchive(archive([{ path: "file" }, { path: "file" }])),
    /duplicate/,
  );
  const compressed = gzipSync(valid);
  await assert.rejects(
    parseBaselineArchive(
      Buffer.concat([
        compressed,
        Buffer.alloc(1024 + ((512 - (compressed.length % 512)) % 512)),
      ]),
    ),
  );
});

test("archive entry limit accepts the boundary and identifies oversized catalogues", async () => {
  const entries = Array.from({ length: 65_536 }, (_, index) => ({
    path: `file-${index}`,
  }));
  assert.equal(
    (await parseBaselineArchive(archive(entries))).length,
    entries.length,
  );
  await assert.rejects(
    parseBaselineArchive(archive([...entries, { path: "one-too-many" }])),
    /exceeds 65536 entries/,
  );
});

test("archive parsing respects a Uint8Array slice with a nonzero offset", async () => {
  const original = archive([{ path: "file", content: "historical bytes" }]);
  const padded = new Uint8Array(original.length + 64);
  padded.set(original, 32);
  const entries = await parseBaselineArchive(padded.subarray(32, -32));
  assert.equal(Buffer.from(entries[0]!.bytes).toString(), "historical bytes");
});

test("baseline commands receive only bounded environment variables and exact argv", async () => {
  const env = baselineEnvironment(
    {
      PATH: "bin",
      HOME: "home",
      LANG: "en",
      LC_ALL: "C",
      TMPDIR: "tmp",
      CI: "0",
      MOKLY_BASELINE_COMMIT: "other",
      NODE_OPTIONS: "--require injected",
      npm_config_token: "secret",
      GIT_DIR: "elsewhere",
      SECRET: "hidden",
    },
    "commit",
  );
  assert.deepEqual(env, {
    PATH: "bin",
    HOME: "home",
    LANG: "en",
    LC_ALL: "C",
    TMPDIR: "tmp",
    CI: "1",
    MOKLY_BASELINE_COMMIT: "commit",
  });
  const { runner } = baselineFixture();
  const received: string[][] = [];
  runner.run = async (request) => {
    received.push([...request.argv]);
    return success;
  };
  await runBaselineCommands(
    runner,
    [
      ["build", "$HOME; echo bad"],
      ["next", ""],
    ],
    "/source",
    env,
  );
  assert.deepEqual(received, [
    ["build", "$HOME; echo bad"],
    ["next", ""],
  ]);
  runner.run = async () => {
    throw new Error("ENOENT");
  };
  await assert.rejects(
    runBaselineCommands(runner, [["missing"]], "/source", env),
    (error) => {
      assert.ok(error instanceof BaselineCommandError);
      assert.equal(error.exitCode, null);
      assert.deepEqual(error.argv, ["missing"]);
      return true;
    },
  );
});

test("baseline environment preserves network configuration and Windows lookup without execution hooks", () => {
  const allowed = {
    Path: "C:\\Program Files\\nodejs",
    SystemRoot: "C:\\Windows",
    ComSpec: "C:\\Windows\\System32\\cmd.exe",
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    USERPROFILE: "C:\\Users\\Builder",
    APPDATA: "C:\\Users\\Builder\\AppData\\Roaming",
    LOCALAPPDATA: "C:\\Users\\Builder\\AppData\\Local",
    HTTPS_PROXY: "http://proxy.example:8080",
    no_proxy: "localhost",
    NODE_EXTRA_CA_CERTS: "cert.pem",
    npm_config_cafile: "npm.pem",
  };
  assert.deepEqual(
    baselineEnvironment(
      { ...allowed, NODE_OPTIONS: "--require bad", npm_config_token: "secret" },
      "commit",
    ),
    {
      ...allowed,
      CI: "1",
      MOKLY_BASELINE_COMMIT: "commit",
    },
  );
});
