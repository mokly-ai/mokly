import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { cleanupAll } from "./helpers/static_cleanup.js";
import { exchange } from "./helpers/static_exchange.js";
import {
  command,
  publicationFixture,
  publish,
} from "./helpers/static_publication.js";

const exec = promisify(execFile);

test(
  "SIGINT during FIFO-blocked Git reports exact build and publish cancellation",
  { timeout: 120_000, skip: process.platform === "win32" },
  async (context) => {
    for (const verb of ["build", "publish"] as const) {
      const root = await publicationFixture();
      const server = await exchange();
      const scratch = path.join(root, ".context");
      await fs.promises.mkdir(scratch);
      const pipe = path.join(scratch, "git.pipe");
      await exec("mkfifo", [pipe]);
      await fs.promises.writeFile(
        path.join(scratch, "git"),
        '#!/bin/sh\nprintf ready > "$MOKLY_GIT_READY"\nexec /bin/cat "$MOKLY_GIT_FIFO"\n',
        { mode: 0o755 },
      );
      let ready!: () => void;
      const readiness = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const watcher = fs.watch(scratch, (_event, name) => {
        if (name === "ready") ready();
      });
      const env = {
        PATH: `${scratch}${path.delimiter}${process.env.PATH}`,
        MOKLY_GIT_READY: path.join(scratch, "ready"),
        MOKLY_GIT_FIFO: pipe,
      };
      const running =
        verb === "build"
          ? command(
              root,
              "build",
              ["--out=.context/site"],
              "plain",
              env,
              context.signal,
            )
          : publish(root, server.endpoint, "plain", {
              env,
              signal: context.signal,
            });
      try {
        await Promise.race([
          readiness,
          running.result.then((result) => {
            throw new Error(`Git did not become ready: ${result.stderr}`);
          }),
        ]);
        running.child.kill("SIGINT");
        const result = await running.result;
        assert.equal(result.code, 1);
        assert.equal(
          result.stderr,
          verb === "build"
            ? "[mokly/build-invalid] build cancelled\n"
            : "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n",
        );
        assert.equal(result.stdout, "");
        assert.equal(server.bodies.length, 0);
        await assert.rejects(fs.promises.stat(path.join(scratch, "site")), {
          code: "ENOENT",
        });
      } finally {
        await cleanupAll([
          async () => {
            watcher.close();
          },
          async () => {
            running.child.kill("SIGKILL");
          },
          () => server.close(),
          () => fs.promises.rm(root, { recursive: true, force: true }),
        ]);
      }
    }
  },
);
