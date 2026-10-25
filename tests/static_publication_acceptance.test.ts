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

const exec = promisify(execFile);
test(
  "assigned leading-dash credentials and configuration reach the receiver without diagnostic leaks",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const token = "-synthetic/credential+padding==";
    const options: { token: string; planStatus?: number } = { token };
    const server = await exchange(options);
    const outputs: string[] = [];
    try {
      await fs.rename(
        path.join(root, "mokly.config.json"),
        path.join(root, "-catalogue.json"),
      );
      await exec("git", ["add", "-A"], { cwd: root });
      await exec("git", ["commit", "-qm", "assigned configuration"], {
        cwd: root,
      });
      for (const rejected of [false, true]) {
        if (rejected) options.planStatus = 401;
        const result = await command(
          root,
          "publish",
          [
            "--no-changes",
            "--config=-catalogue.json",
            `--token=${token}`,
            `--endpoint=${server.endpoint}`,
            "--repository=example.com/team/site",
          ],
          "plain",
          { MOKLY_DIAGNOSTIC: "1", MOKLY_TOKEN: "ignored-env-token" },
          context.signal,
        ).result;
        outputs.push(directory(result.stdout));
        assert.equal(result.code, rejected ? 1 : 0, result.stderr);
        assert.ok(!(result.stdout + result.stderr).includes(token));
        assert.ok(
          !(result.stdout + result.stderr).includes(encodeURIComponent(token)),
        );
        if (rejected) {
          assert.match(result.stderr, /\[mokly\/upload-unauthorized\]/u);
          assert.match(result.stderr, /Diagnostic causes/u);
        } else assert.match(result.stdout, /Published Mokly catalogue/u);
      }
      assert.equal(server.metadata[0]?.configPath, "-catalogue.json");
      assert.equal(server.bodies.length, 2);
      assert.equal(server.completed, 1);
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
  "real publication retries each retryable status at Plan Blob and Complete with concurrency one",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    try {
      for (const status of [408, 429, 500, 502, 503, 504]) {
        const server = await exchange({ retryStatus: status });
        let output: string | undefined;
        try {
          const result = await publish(root, server.endpoint, "plain", {
            args: ["--upload-concurrency=1"],
            signal: context.signal,
          }).result;
          output = directory(result.stdout);
          assert.equal(result.code, 0, `${status}: ${result.stderr}`);
          assert.equal(server.bodies.length, 2);
          assert.deepEqual(server.bodies[0], server.bodies[1]);
          assert.ok(server.attempts.size > 0);
          assert.ok(
            [...server.attempts.values()].every((count) => count === 2),
          );
          assert.equal(server.completionAttempts, 2);
          assert.equal(server.completed, 1);
          assert.equal(server.maximumBlobConcurrency, 1);
        } finally {
          await cleanupAll([
            () => server.close(),
            async () => {
              if (output) await removeOutput(output);
            },
          ]);
        }
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
