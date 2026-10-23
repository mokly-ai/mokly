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
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";

const exec = promisify(execFile);

test(
  "SIGINT during a pipe-blocked render cancels build and publish before installation",
  { timeout: 120_000, skip: process.platform === "win32" },
  async (context) => {
    for (const verb of ["build", "publish"] as const) {
      const root = await publicationFixture(true);
      const server = await exchange();
      let output: string | undefined;
      await fs.promises.mkdir(path.join(root, ".context"));
      await exec("mkfifo", [path.join(root, ".context/render.pipe")]);
      await fs.promises.writeFile(
        path.join(root, "specs/home.mockup.ts"),
        `import fs from 'node:fs'; import {definePage} from '@mokly/mokly'; export default definePage({title:'Home',description:'',relatedDocs:[],render(){fs.writeFileSync('.context/ready','ready');fs.readFileSync('.context/render.pipe');return '<html><body>Home</body></html>'}});`,
      );
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-qm", "blocking render"], { cwd: root });
      let ready!: () => void;
      const readiness = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const watcher = fs.watch(
        path.join(root, ".context"),
        (_event, filename) => {
          if (filename === "ready") ready();
        },
      );
      const running =
        verb === "publish"
          ? publish(root, server.endpoint, "plain", { signal: context.signal })
          : command(
              root,
              "build",
              ["--no-changes", "--sidecars=1", "--out=.context/site"],
              "plain",
              {},
              context.signal,
            );
      try {
        await Promise.race([
          readiness,
          running.result.then((result) => {
            throw new Error(`Exited before render readiness: ${result.stderr}`);
          }),
        ]);
        running.child.kill("SIGINT");
        const result = await running.result;
        assert.equal(result.code, 1);
        if (verb === "publish") {
          output = directory(result.stdout);
          assert.equal(
            result.stderr,
            "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n",
          );
        } else {
          assert.equal(
            result.stderr,
            "[mokly/build-invalid] build cancelled\n",
          );
          assert.equal(result.stdout, "");
        }
        assert.equal(server.bodies.length, 0);
        await assert.rejects(
          fs.promises.stat(output ?? path.join(root, ".context/site")),
          { code: "ENOENT" },
        );
      } finally {
        await cleanupAll([
          async () => {
            watcher.close();
          },
          async () => {
            running.child.kill("SIGKILL");
          },
          () => server.close(),
          async () => {
            if (output) await removeOutput(output);
          },
          () => fs.promises.rm(root, { recursive: true, force: true }),
        ]);
      }
    }
  },
);

for (const mode of ["plain", "rich"])
  test(
    `${mode} SIGINT during Blob upload keeps the installed site and uses cancellation copy`,
    { timeout: 120_000, skip: process.platform === "win32" },
    async (context) => {
      const root = await publicationFixture();
      let signals = 0;
      const interrupt = () => {
        if (signals !== 0) return;
        signals++;
        running.child.kill("SIGINT");
      };
      const server = await exchange({ holdBlob: interrupt });
      let output: string | undefined;
      const running = publish(root, server.endpoint, mode, {
        signal: context.signal,
      });

      try {
        const result = await running.result;
        output = directory(result.stdout);
        assert.equal(signals, 1);
        assert.equal(result.code, 1);
        assert.match(result.stderr, /Publication was cancelled/);
        assert.ok(!result.stderr.includes("connection"));
        assert.ok(!result.stderr.includes("private/a=="));
        if (mode === "rich") assert.match(result.stdout, /Uploading catalogue/);
        else
          assert.equal(
            result.stderr,
            "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n",
          );
        assert.equal(server.completed, 0);
        assert.ok(
          (
            await fs.promises.stat(path.join(output, ".mokly-export-artifact"))
          ).isFile(),
        );
      } finally {
        await cleanupAll([
          async () => {
            running.child.kill("SIGKILL");
          },
          () => server.close(),
          async () => {
            if (output) await removeOutput(output);
          },
          () => fs.promises.rm(root, { recursive: true, force: true }),
        ]);
      }
    },
  );
