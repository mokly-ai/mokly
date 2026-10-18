import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { cleanupAll } from "./helpers/static_cleanup.js";
import { exchange } from "./helpers/static_exchange.js";
import {
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";

const exec = promisify(execFile);
const git = (root: string, ...args: string[]) =>
  exec("git", args, { cwd: root });
test(
  "publication rejects every dirty checkout variant before allocating output or requesting Plan",
  { timeout: 120_000 },
  async (context) => {
    const cases = [
      "modified",
      "staged",
      "deleted",
      "renamed",
      "untracked",
      "hidden-untracked",
      "temporary-name",
      "temporary-directory",
      "tracked-temporary",
      "unmerged",
      ...(process.platform === "win32" ? [] : ["type", "unusual-name"]),
    ];
    for (const name of cases) {
      const root = await publicationFixture();
      const server = await exchange();
      try {
        const tracked = path.join(root, "signal.txt");
        let expected = "signal.txt";
        if (name === "modified" || name === "staged") {
          await fs.writeFile(tracked, "changed");
          if (name === "staged") await git(root, "add", "signal.txt");
        } else if (name === "deleted") await fs.unlink(tracked);
        else if (name === "renamed") {
          await git(root, "mv", "signal.txt", "renamed.txt");
          expected = "renamed.txt";
        } else if (name === "type") {
          await fs.unlink(tracked);
          await fs.symlink("mokly.config.json", tracked);
        } else if (name === "unmerged") {
          const head = (await git(root, "rev-parse", "HEAD")).stdout.trim();
          await git(root, "switch", "-c", "conflict");
          await fs.writeFile(tracked, "branch");
          await git(root, "commit", "-am", "branch");
          await git(root, "switch", "--detach", head);
          await fs.writeFile(tracked, "head");
          await git(root, "commit", "-am", "head");
          await assert.rejects(git(root, "merge", "conflict"));
        } else {
          expected =
            name === "temporary-name"
              ? ".mokly-review-notes.md"
              : name.includes("temporary")
                ? "mokly-config-author/config.mjs"
                : name === "unusual-name"
                  ? 'a "quote"\nname.md'
                  : "new.md";
          if (name === "hidden-untracked")
            await git(root, "config", "status.showUntrackedFiles", "no");
          await fs.mkdir(path.dirname(path.join(root, expected)), {
            recursive: true,
          });
          await fs.writeFile(path.join(root, expected), "original");
          if (name === "tracked-temporary") {
            await git(root, "add", ".");
            await git(root, "commit", "-qm", "temporary name");
            await fs.writeFile(path.join(root, expected), "changed");
          }
        }
        const result = await publish(root, server.endpoint, "plain", {
          signal: context.signal,
        }).result;
        assert.equal(result.code, 1, name);
        assert.match(result.stderr, /\[mokly\/git-uncommitted\]/u);
        assert.ok(
          result.stderr.includes(expected.replaceAll("\n", "\\u000a")),
          `${name}: ${result.stderr}`,
        );
        assert.equal(result.stdout, "");
        assert.equal(server.bodies.length, 0);
      } finally {
        await cleanupAll([
          () => server.close(),
          () => fs.rm(root, { recursive: true, force: true }),
        ]);
      }
    }
  },
);
test(
  "Git-ignored output and ordinary ignored files do not block a full publication",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const server = await exchange();
    let output: string | undefined;
    try {
      await fs.mkdir(path.join(root, ".context"));
      await fs.writeFile(path.join(root, ".context/notes"), "ignored");
      const result = await publish(root, server.endpoint, "plain", {
        signal: context.signal,
      }).result;
      output = directory(result.stdout);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(server.completed, 1);
    } finally {
      await cleanupAll([
        () => server.close(),
        async () => {
          if (output) await removeOutput(output);
        },
        () => fs.rm(root, { recursive: true, force: true }),
      ]);
    }
  },
);

test(
  "publication reports dirty submodules even when Git settings hide them",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const submodule = await publicationFixture();
    const server = await exchange();
    try {
      await git(
        root,
        "-c",
        "protocol.file.allow=always",
        "submodule",
        "add",
        submodule,
        "modules/demo",
      );
      await git(root, "commit", "-am", "submodule");
      await git(root, "config", "diff.ignoreSubmodules", "all");
      await fs.writeFile(
        path.join(root, "modules/demo/signal.txt"),
        "changed submodule",
      );
      const result = await publish(root, server.endpoint, "plain", {
        signal: context.signal,
      }).result;
      assert.equal(result.code, 1);
      assert.match(result.stderr, /\[mokly\/git-uncommitted\]/u);
      assert.match(result.stderr, /modules\/demo/u);
      assert.equal(result.stdout, "");
      assert.equal(server.bodies.length, 0);
    } finally {
      await cleanupAll([
        () => server.close(),
        () => fs.rm(root, { recursive: true, force: true }),
        () => fs.rm(submodule, { recursive: true, force: true }),
      ]);
    }
  },
);
