import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import { parseAllDocuments } from "yaml";

const golden = await readFile(
  new URL("./golden/preview-pr.yaml", import.meta.url),
  "utf8",
);
const catalogue = parseAllDocuments(golden)
  .map((document) => document.toJS())
  .find(
    (document) =>
      document.kind === "Deployment" && document.metadata.name === "catalogue",
  );
const gate = catalogue.spec.template.spec.initContainers[0];
const revision = gate.env[0].value;
const ready = { status: "ok", migrations: "current", revision };
const source = `(async () => { ${gate.args[0]} })()`;

async function simulate(outcomes, expectedCode) {
  let now = 0;
  let calls = 0;
  const sleeps = [];
  const errors = [];
  const exit = {};
  await runInNewContext(source, {
    performance: { now: () => now },
    process: {
      env: { MKC_EXPECTED_REVISION: revision },
      exit: (code) => {
        exit.code = code;
        throw exit;
      },
    },
    console: { error: (message) => errors.push(message) },
    AbortSignal: {
      timeout: (timeout) => {
        assert.ok(timeout > 0 && timeout <= 5_000);
        assert.ok(timeout <= 600_000 - now);
        return { timeout };
      },
    },
    setTimeout: (callback, delay) => {
      assert.ok(delay > 0 && delay <= 2_000);
      now += delay;
      sleeps.push(delay);
      callback();
    },
    fetch: async (url, { signal }) => {
      assert.equal(url, "http://api:8080/v1/health");
      const outcome = outcomes[Math.min(calls++, outcomes.length - 1)];
      now += Math.min(outcome.duration ?? 0, signal.timeout);
      if (outcome.error || outcome.duration > signal.timeout) {
        throw new Error("Request unavailable or timed out");
      }
      return {
        ok: outcome.ok ?? true,
        json: async () => {
          if (outcome.bodyTimeout) {
            now += signal.timeout;
            throw new Error("Body timed out");
          }
          if (outcome.invalidJson) throw new SyntaxError("Invalid JSON");
          return outcome.body;
        },
      };
    },
  }).catch((error) => {
    if (error !== exit) throw error;
  });
  assert.equal(exit.code ?? 0, expectedCode);
  assert.ok(now <= 600_000);
  assert.equal(errors.length, expectedCode ? 1 : 0);
  if (expectedCode) assert.equal(now, 600_000);
  return { calls, sleeps, now };
}

assert.equal((await simulate([{ body: ready }], 0)).calls, 1);
const retryCases = [
  { error: true },
  { ok: false, body: ready },
  { invalidJson: true },
  { body: null },
  { body: {} },
  { body: { ...ready, status: "unavailable" } },
  { body: { ...ready, migrations: "pending" } },
  { body: { ...ready, revision: "b".repeat(40) } },
  { duration: 6_000, body: ready },
  { bodyTimeout: true },
];
for (const failure of retryCases) {
  const retry = await simulate([failure, { body: ready }], 0);
  assert.equal(retry.calls, 2);
  assert.deepEqual(retry.sleeps, [2_000]);
  await simulate([failure], 1);
}

let requests = 0;
const server = createServer((request, response) => {
  assert.equal(request.url, "/v1/health");
  requests++;
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify(
      requests === 1 ? { ...ready, revision: "b".repeat(40) } : ready,
    ),
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  await runInNewContext(source, {
    performance,
    AbortSignal,
    setTimeout,
    console,
    process: {
      env: { MKC_EXPECTED_REVISION: revision },
      exit: (code) => assert.fail(`Loopback readiness exited ${code}`),
    },
    fetch: (url, options) => {
      assert.equal(url, "http://api:8080/v1/health");
      return fetch(
        `http://127.0.0.1:${server.address().port}/v1/health`,
        options,
      );
    },
  });
  assert.equal(requests, 2);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
console.log(
  "PASS rendered API gate: retries, deadlines, revision and HTTP smoke",
);
