import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { parse } from "yaml";

interface Step {
  uses?: string;
  env?: Record<string, string>;
  with?: { script?: string };
}
async function script(): Promise<string> {
  const workflow = parse(
    await fs.readFile(".github/workflows/preview.yml", "utf8"),
  ) as { jobs: Record<string, { steps: Step[] }> };
  const step = Object.values(workflow.jobs)
    .flatMap((job) => job.steps)
    .find(
      (step) =>
        step.uses?.includes("github-script@") && step.env?.CLOUDFLARE_API_TOKEN,
    );
  assert.ok(step?.with?.script);
  return step.with.script;
}
async function execute(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; method: string }> = [];
  const outputs: string[] = [];
  const fn = Object.getPrototypeOf(async () => {}).constructor as new (
    ...args: string[]
  ) => (...args: unknown[]) => Promise<void>;
  await new fn("process", "core", "fetch", await script())(
    {
      env: {
        CLOUDFLARE_ACCOUNT_ID: "account",
        CLOUDFLARE_API_TOKEN: "private-token",
        CLOUDFLARE_PROJECT_NAME: "site",
        PREVIEW_BRANCH: "pr-3",
      },
    },
    { setOutput: (_name: string, value: string) => outputs.push(value) },
    async (url: string, options: { method: string }) => {
      calls.push({ url, method: options.method });
      const next = responses.shift();
      assert.ok(next);
      return new Response(JSON.stringify(next.body), { status: next.status });
    },
  );
  assert.equal(responses.length, 0);
  return { calls, outputs };
}
const deployment = (id: string) => ({
  id,
  deployment_trigger: { metadata: { branch: "pr-3" } },
});

test("cleanup follows total_pages across short pages and names failed deletions", async () => {
  const result = await execute([
    {
      status: 200,
      body: {
        success: true,
        result: [deployment("one")],
        result_info: { total_pages: 2 },
      },
    },
    {
      status: 200,
      body: {
        success: true,
        result: [deployment("two")],
        result_info: { total_pages: 2 },
      },
    },
    { status: 200, body: { success: true } },
    {
      status: 403,
      body: {
        success: false,
        errors: [{ message: "permission denied private-token" }],
      },
    },
  ]);
  assert.ok(result.calls[1]?.url.endsWith("page=2"));
  assert.equal(
    result.calls.filter((call) => call.method === "DELETE").length,
    2,
  );
  assert.match(
    result.outputs[0]!,
    /two: DELETE HTTP 403: permission denied \[redacted\]/,
  );
  assert.ok(!result.outputs.join().includes("private-token"));
});

test("cleanup explains a list rejection before attempting any deletion", async () => {
  const result = await execute([
    {
      status: 503,
      body: { success: false, errors: [{ message: "service unavailable" }] },
    },
  ]);
  assert.equal(result.calls.length, 1);
  assert.match(result.outputs[0]!, /GET HTTP 503: service unavailable/);
});

test("cleanup without total_pages continues until an empty page", async () => {
  const result = await execute([
    { status: 200, body: { success: true, result: [deployment("one")] } },
    { status: 200, body: { success: true, result: [] } },
    { status: 200, body: { success: true } },
  ]);
  assert.equal(result.calls.length, 3);
  assert.ok(result.calls[1]?.url.endsWith("page=2"));
  assert.equal(result.calls[2]?.method, "DELETE");
  assert.deepEqual(result.outputs, ["deleted: 1 branch deployments"]);
});

test("cleanup caps pagination and retains all deployments before any delete", async () => {
  const result = await execute(
    Array.from({ length: 100 }, () => ({
      status: 200,
      body: { success: true, result: [deployment("one")] },
    })),
  );
  assert.equal(result.calls.length, 100);
  assert.ok(result.calls.every((call) => call.method === "GET"));
  assert.deepEqual(result.outputs, [
    "retained: deployment pagination exceeded 100 pages; branch deployments retained",
  ]);
});
