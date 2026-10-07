import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

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
