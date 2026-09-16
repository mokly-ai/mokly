import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  readWorkflow,
  runWorkflowShell,
  workflowStep,
} from "./helpers/workflow.js";

const workflow = await readWorkflow("site.yml");
const step = workflowStep(
  workflow.jobs["close-pr"]!,
  "Delete Cloudflare Pages PR deployments",
);

interface Response {
  body?: unknown;
  status?: number;
  transportFailure?: boolean;
}

const deployment = (id: string, branch: string) => ({
  deployment_trigger: { metadata: { branch } },
  id,
});
const listed = (result: unknown[], totalPages = 1) => ({
  result,
  result_info: { total_pages: totalPages },
  success: true,
});

test("close targets the PR branch and deletes matching deployments across every page", async (t) => {
  assert.equal(
    step.env?.PREVIEW_BRANCH,
    "pr-${{ github.event.pull_request.number }}",
  );
  const result = await cleanup(t, [
    {
      body: listed(
        [deployment("first", "pr-71"), deployment("main", "main")],
        2,
      ),
    },
    {
      body: listed(
        [deployment("second", "pr-71"), deployment("other", "pr-72")],
        2,
      ),
    },
    { body: { success: true } },
    { body: { success: true } },
  ]);
  assert.equal(result.code, 0);
  assert.match(await result.rootFiles("output"), /deleted: removed 2 matching/);
  const requests = await result.rootFiles("requests");
  assert.match(
    requests,
    /projects\/mokly-site\/deployments\?per_page=100&page=2/,
  );
  assert.match(requests, /\/deployments\/first\?force=true/);
  assert.match(requests, /\/deployments\/second\?force=true/);
  assert.doesNotMatch(requests, /\/deployments\/(?:main|other)\?/);
});

test("cleanup reports missing credentials without making a request", async (t) => {
  const result = await cleanup(t, [], { CLOUDFLARE_API_TOKEN: "" });
  assert.match(
    await result.rootFiles("output"),
    /retained: missing Cloudflare configuration/,
  );
  assert.equal(await result.rootFiles("requests"), "");
});

test("cleanup reports list HTTP, transport and invalid-response failures", async (t) => {
  for (const response of [
    { status: 403, body: { errors: [{ message: "denied" }], success: false } },
    { transportFailure: true },
    { body: { success: false, errors: [{ message: "invalid token" }] } },
    { body: "not JSON" },
  ]) {
    const result = await cleanup(t, [response]);
    assert.match(
      await result.rootFiles("output"),
      /retained: failed to (list|parse)/,
    );
  }
});

test("cleanup reports partial delete failure and still attempts every deployment", async (t) => {
  const result = await cleanup(t, [
    {
      body: listed([
        deployment("first", "pr-71"),
        deployment("second", "pr-71"),
      ]),
    },
    { status: 403, body: { errors: [{ message: "denied" }] } },
    { body: { success: true } },
  ]);
  assert.match(
    await result.rootFiles("output"),
    /retained: failed to delete 1 .*; deleted 1/,
  );
  assert.match(result.output, /::warning.*denied/);
  assert.match(
    await result.rootFiles("requests"),
    /\/deployments\/second\?force=true/,
  );
});

test("cleanup reports delete transport and API failures instead of claiming success", async (t) => {
  for (const response of [
    { transportFailure: true },
    { body: { success: false, errors: [{ message: "denied" }] } },
  ]) {
    const result = await cleanup(t, [
      { body: listed([deployment("first", "pr-71")]) },
      response,
    ]);
    assert.match(
      await result.rootFiles("output"),
      /retained: failed to delete 1/,
    );
  }
});

test("cleanup distinguishes an empty matching set from a failed listing", async (t) => {
  const result = await cleanup(t, [
    { body: listed([deployment("main", "main")]) },
  ]);
  assert.match(
    await result.rootFiles("output"),
    /deleted: no matching branch deployments/,
  );
});

async function cleanup(
  t: TestContext,
  responses: Response[],
  environment: Record<string, string> = {},
) {
  const script = step.run!.startsWith("bash ")
    ? await readFile(
        path.join(repositoryRoot, step.run!.trim().slice(5)),
        "utf8",
      )
    : step.run!;
  const result = await runWorkflowShell(
    `
    curl() {
      local output_file request_url index
      while [ "$#" -gt 0 ]; do
        case "$1" in
          --output) output_file="$2"; shift ;;
          https://*) request_url="$1" ;;
        esac
        shift
      done
      echo "$request_url" >> requests
      index="$(cat index)"
      echo "$((index + 1))" > index
      if [ -f "$index.transport" ]; then return 7; fi
      cp "$index.body" "$output_file"
      cat "$index.status"
    }
    ${script}
  `,
    {
      CLOUDFLARE_ACCOUNT_ID: "test-account",
      CLOUDFLARE_API_TOKEN: "test-token",
      CLOUDFLARE_PROJECT_NAME: workflow.env!.CLOUDFLARE_PROJECT_NAME!,
      PREVIEW_BRANCH: "pr-71",
      ...environment,
    },
    async (root) => {
      await writeFile(path.join(root, "index"), "0");
      await writeFile(path.join(root, "requests"), "");
      for (const [index, response] of responses.entries()) {
        await writeFile(
          path.join(root, `${index}.body`),
          typeof response.body === "string"
            ? response.body
            : JSON.stringify(response.body ?? {}),
        );
        await writeFile(
          path.join(root, `${index}.status`),
          String(response.status ?? 200),
        );
        if (response.transportFailure)
          await writeFile(path.join(root, `${index}.transport`), "");
      }
    },
  );
  t.after(result.dispose);
  return result;
}
