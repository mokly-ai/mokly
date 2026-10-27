import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { cleanupAll } from "./helpers/static_cleanup.js";
import { exchange } from "./helpers/static_exchange.js";
import {
  command,
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

const exec = promisify(execFile);
async function commit(root: string) {
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "changed"], { cwd: root });
}

test(
  "environment credentials and nested configuration publish a delta after an entry edit",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture(false, "sha256");
    const server = await exchange();
    const outputs: string[] = [];
    try {
      await fs.mkdir(path.join(root, "tools"));
      await fs.writeFile(path.join(root, "tools/mokly.config.json"), "{}");
      await fs.rename(path.join(root, "specs"), path.join(root, "tools/specs"));
      await commit(root);
      for (const change of ["initial", "entry", "unrelated"]) {
        if (change === "entry") {
          await fs.appendFile(
            path.join(root, "tools/specs/home.screen.html"),
            "<p>Changed</p>",
          );
          await commit(root);
        }
        if (change === "unrelated") {
          await fs.appendFile(path.join(root, "signal.txt"), "other input");
          await commit(root);
        }
        const previousBlobAttempts = new Map(server.attempts);
        const result = await publish(root, server.endpoint, "plain", {
          environmentCredentials: true,
          args: ["--config=tools/mokly.config.json"],
          signal: context.signal,
        }).result;
        outputs.push(directory(result.stdout));
        assert.equal(result.code, 0, result.stderr);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Published Mokly catalogue/);
        if (change === "unrelated") {
          assert.deepEqual(server.attempts, previousBlobAttempts);
          // The Plan archive still carries the new publication metadata and
          // the catalogue index.
          assert.match(result.stdout, /2 files uploaded/);
        }
      }
      assert.equal(server.metadata[0]?.configPath, "tools/mokly.config.json");
      assert.equal(server.metadata[0]?.headSha.length, 64);
      assert.notEqual(server.metadata[0]?.headSha, server.metadata[1]?.headSha);
      assert.ok(server.missingCounts[0]! > server.missingCounts[1]!);
      assert.ok(server.missingCounts[1]! > 0);
      assert.notEqual(server.metadata[1]?.headSha, server.metadata[2]?.headSha);
      assert.equal(server.missingCounts[2], 0);
      assert.equal(server.completed, 3);
    } finally {
      await cleanupAll([
        () => server.close(),
        ...outputs.map((output) => () => removeOutput(output)),
        () => fs.rm(root, { recursive: true, force: true }),
      ]);
    }
  },
);

test(
  "publish warnings allow upload unless strict mode is requested",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const server = await exchange();
    const outputs: string[] = [];
    try {
      await fs.writeFile(
        path.join(root, "specs/home.screen.html"),
        "---\ntitle: Home\nprops: {label: Unused}\n---\n<p>Home</p>",
      );
      await commit(root);
      for (const strict of [true, false]) {
        const result = await publish(root, server.endpoint, "plain", {
          args: strict ? ["--strict"] : [],
          signal: context.signal,
        }).result;
        outputs.push(directory(result.stdout));
        assert.equal(result.code, strict ? 1 : 0, result.stderr);
        assert.equal(result.stderr.match(/\[mokly\/warning\]/g)?.length, 1);
        assert.equal(result.stderr.includes("with --strict"), strict);
        assert.equal(server.completed, strict ? 0 : 1);
        if (strict) assert.equal(server.bodies.length, 0);
        else assert.match(result.stdout, /Published Mokly catalogue/);
      }
      assert.equal(server.bodies.length, 1);
    } finally {
      await cleanupAll([
        () => server.close(),
        ...outputs.map((output) => () => removeOutput(output)),
        () => fs.rm(root, { recursive: true, force: true }),
      ]);
    }
  },
);

test(
  "an invalid output is refused before Git history work and author execution",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    try {
      await fs.mkdir(path.join(root, "unowned"));
      await fs.writeFile(path.join(root, "unowned/keep"), "keep");
      const result = await command(
        root,
        "build",
        ["--out=unowned", "--base=absent-ref"],
        "plain",
        {},
        context.signal,
      ).result;
      assert.equal(result.code, 1);
      assert.match(result.stderr, /\[mokly\/export-invalid\]/);
      assert.ok(!result.stderr.includes("git-failed"));
      assert.equal(
        await fs.readFile(path.join(root, "unowned/keep"), "utf8"),
        "keep",
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "timings preserve plain output and diagnostic causes redact credentials",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const server = await exchange();
    const outputs: string[] = [];
    try {
      const built = await command(
        root,
        "build",
        ["--no-changes", "--debug-timings"],
        "rich",
        {},
        context.signal,
      ).result;
      assert.equal(built.code, 0, built.stderr);
      assert.match(built.stdout, /^Built Mokly to/);
      const result = await publish(root, server.endpoint, "rich", {
        args: ["--debug-timings"],
        signal: context.signal,
      }).result;
      outputs.push(directory(result.stdout));
      assert.equal(result.code, 0, result.stderr);
      for (const output of [built, result]) {
        const records = timings(output.stderr);
        assert.ok(records.some((record) => record.stage === "config.load"));
        assert.ok(
          records.some(
            (record) =>
              record.stage === "output.install" && record.event === "end",
          ),
        );
        assert.ok(
          records.some(
            (record) =>
              record.stage === "render.document" &&
              record.parentId !== undefined,
          ),
        );
        assert.ok(!output.stdout.includes("✔"));
      }
      assert.ok(result.stderr.includes('"stage":"upload.plan"'));
      const badBase = await command(
        root,
        "build",
        ["--base=absent-base", "--debug-timings"],
        "plain",
        {},
        context.signal,
      ).result;
      assert.equal(badBase.code, 1);
      assert.ok(
        timings(badBase.stderr).some(
          (record) =>
            record.stage === "review.base-commit" &&
            record.event === "end" &&
            record.status === "error",
        ),
      );
      await fs.writeFile(
        path.join(root, "mokly.config.json"),
        '{"private/a==":true}',
      );
      const failure = await command(
        root,
        "build",
        ["--no-changes"],
        "plain",
        {
          MOKLY_DIAGNOSTIC: "1",
          MOKLY_TOKEN: "private/a==",
        },
        context.signal,
      ).result;
      assert.equal(failure.code, 1);
      assert.match(failure.stderr, /Diagnostic causes:/);
      assert.match(failure.stderr, /\[redacted\]/);
      assert.ok(!failure.stderr.includes("private/a=="));
    } finally {
      await cleanupAll([
        () => server.close(),
        ...outputs.map((output) => () => removeOutput(output)),
        () => fs.rm(root, { recursive: true, force: true }),
      ]);
    }
  },
);

test(
  "an older receiver fails the real publication with 426 and retains the build",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const server = await exchange({ planStatus: 426 });
    let output: string | undefined;
    try {
      const result = await publish(root, server.endpoint, "plain", {
        ...{
          env: { MOKLY_DIAGNOSTIC: "1" },
        },
        signal: context.signal,
      }).result;
      output = directory(result.stdout);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /\[mokly\/upload-unsupported-version\]/);
      assert.match(result.stderr, /Diagnostic causes:/);
      assert.ok(!result.stderr.includes("private/a=="));
      assert.equal(server.bodies.length, 1);
      assert.equal(server.attempts.size, 0);
      assert.equal(server.completed, 0);
      assert.ok(
        (await fs.stat(path.join(output, ".mokly-export-artifact"))).isFile(),
      );
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
