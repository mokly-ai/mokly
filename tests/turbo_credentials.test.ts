import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

const signalStub = `
const fs = require("node:fs");
const readline = require("node:readline");
const record = (event) => {
  fs.appendFileSync("events", event + "\\n");
  process.stdout.write(event + "\\n");
};
let terminatingSignal;
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    terminatingSignal ??= signal;
    record(signal);
  });
}
readline.createInterface({ input: process.stdin }).on("line", () => {
  record("child-exit");
  process.removeAllListeners(terminatingSignal);
  process.kill(process.pid, terminatingSignal);
});
fs.writeFileSync("ready", String(process.pid));
record("ready");
`;

if (process.platform !== "win32") {
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    test(
      `launcher waits for its child during ${signal} and preserves its exit signal`,
      { timeout: 30_000 },
      async (context) => {
        const root = await fs.mkdtemp(
          path.join(os.tmpdir(), "mokly-turbo-signals-"),
        );
        const eventsFile = path.join(root, "events");
        await fs.mkdir(path.join(root, "node_modules/turbo/bin"), {
          recursive: true,
        });
        await fs.copyFile(
          path.join(repositoryRoot, "scripts/turbo-run.mjs"),
          path.join(root, "turbo-run.mjs"),
        );
        await fs.writeFile(
          path.join(root, "node_modules/turbo/bin/turbo"),
          signalStub,
        );
        const launcher = spawn(process.execPath, ["turbo-run.mjs", "build"], {
          cwd: root,
          detached: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
        const exited = new Promise<{
          code: number | null;
          signal: NodeJS.Signals | null;
        }>((resolve, reject) => {
          launcher.once("error", reject);
          launcher.once("exit", (code, exitSignal) => {
            appendFileSync(eventsFile, "launcher-exit\n");
            resolve({ code, signal: exitSignal });
          });
        });
        const closed = new Promise<void>((resolve) => {
          launcher.once("close", () => resolve());
        });
        const received = new Set<string>();
        const pending = new Map<string, () => void>();
        const lines = createInterface({ input: launcher.stdout });
        lines.on("line", (line) => {
          received.add(line);
          pending.get(line)?.();
        });
        let stderr = "";
        launcher.stderr.setEncoding("utf8").on("data", (chunk) => {
          stderr += chunk;
        });
        context.after(async () => {
          if (launcher.pid) {
            try {
              process.kill(-launcher.pid, "SIGKILL");
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ESRCH")
                throw error;
            }
          }
          await closed;
          lines.close();
          await fs.rm(root, { recursive: true, force: true });
        });
        const waitFor = (event: string) =>
          Promise.race([
            received.has(event)
              ? Promise.resolve()
              : new Promise<void>((resolve) => pending.set(event, resolve)),
            exited.then(() => {
              throw new Error(`Launcher exited before ${event}: ${stderr}`);
            }),
          ]);
        await waitFor("ready");
        assert.ok(Number(await fs.readFile(path.join(root, "ready"), "utf8")));
        assert.ok(launcher.pid);
        if (signal === "SIGINT") process.kill(-launcher.pid, signal);
        else assert.equal(launcher.kill(signal), true);
        await waitFor(signal);
        if (signal === "SIGINT") {
          assert.equal(launcher.kill("SIGTERM"), true);
          await waitFor("SIGTERM");
        }
        assert.equal(launcher.exitCode, null);
        assert.equal(launcher.signalCode, null);
        appendFileSync(eventsFile, "release\n");
        launcher.stdin.end("finish\n");
        assert.deepEqual(await exited, { code: null, signal });
        await closed;
        assert.equal(stderr, "");
        assert.deepEqual(
          (await fs.readFile(eventsFile, "utf8")).trim().split("\n"),
          [
            "ready",
            signal,
            ...(signal === "SIGINT" ? ["SIGTERM"] : []),
            "release",
            "child-exit",
            "launcher-exit",
          ],
        );
      },
    );
  }
}

test("the complete PR pair reaches the client and overrides the committed trusted team", async (context) => {
  const namespaces: (string | null)[] = [];
  const token = "synthetic-pr-token".padEnd(64, "p");
  const server = http.createServer((request, response) => {
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    namespaces.push(
      new URL(request.url!, "http://localhost").searchParams.get("slug"),
    );
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"status":"enabled"}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TURBO_API: `http://127.0.0.1:${address.port}`,
    TURBO_TEAM: "mokly-pr-42",
    TURBO_TOKEN: token,
    TURBO_REMOTE_CACHE_SIGNATURE_KEY: "a".repeat(64),
    TURBO_CACHE: "local:rw",
    TURBO_TELEMETRY_DISABLED: "1",
  };
  delete env.TURBO_TEAMID;
  delete env.TURBO_FORCE;
  await execute("npm", ["run", "prepare:verification"], {
    cwd: repositoryRoot,
    env,
    maxBuffer: 8_000_000,
  });
  await execute("git", ["diff", "--exit-code", "AGENTS.md"], {
    cwd: repositoryRoot,
  });
  assert.ok(namespaces.length > 0);
  assert.ok(namespaces.every((namespace) => namespace === "mokly-pr-42"));
});

test("root preparation removes incomplete credentials and never contacts the cache", async (context) => {
  let requests = 0;
  const server = http.createServer((_request, response) => {
    requests++;
    response.writeHead(503).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  for (const provided of ["neither", "token-only", "key-only"]) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TURBO_API: `http://127.0.0.1:${address.port}`,
      TURBO_CACHE: "local:rw",
      TURBO_TELEMETRY_DISABLED: "1",
    };
    for (const name of [
      "TURBO_TOKEN",
      "TURBO_REMOTE_CACHE_SIGNATURE_KEY",
      "TURBO_TEAM",
      "TURBO_TEAMID",
      "TURBO_FORCE",
    ])
      delete env[name];
    if (provided === "token-only") env.TURBO_TOKEN = "synthetic-test-token";
    if (provided === "key-only")
      env.TURBO_REMOTE_CACHE_SIGNATURE_KEY = "a".repeat(64);
    const result = await execute("npm", ["run", "prepare:verification"], {
      cwd: repositoryRoot,
      env,
      maxBuffer: 8_000_000,
    });
    assert.ok(result.stdout.includes("Remote caching disabled"));
    await execute("git", ["diff", "--exit-code", "AGENTS.md"], {
      cwd: repositoryRoot,
    });
    assert.equal(requests, 0, provided);
  }
});
