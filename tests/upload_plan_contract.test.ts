import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { completeUpload } from "../dist/publish/complete.js";
import { requestUploadPlan } from "../dist/publish/plan.js";
import { ReplanRequired } from "../dist/publish/retry.js";

import { repositoryRoot } from "./helpers/fixture.js";

interface FixtureCase {
  name: string;
  step?: "plan" | "complete";
  valid: boolean;
  status?: number;
  contentType?: string | null;
  document?: unknown;
  body?: string;
  outcome?: string;
  viewerUrl?: string | null;
}

interface UploadPlanFixture {
  schemaVersion: number;
  endpoint: string;
  marker: string[];
  cases: FixtureCase[];
}

const retryDependencies = {
  now: () => new Date("2026-09-26T12:00:00.000Z"),
  random: () => 0,
  sleep: async () => undefined,
};

async function fixture(): Promise<UploadPlanFixture> {
  return JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, "docs/protocol/fixtures/upload-plan-v1.json"),
      "utf8",
    ),
  ) as UploadPlanFixture;
}

function response(sample: FixtureCase): Response {
  const status = sample.status ?? 200;
  const raw = Object.hasOwn(sample, "document")
    ? JSON.stringify(sample.document)
    : (sample.body ?? "");
  const body = status === 204 ? null : raw;
  const headers = new Headers();
  const contentType = Object.hasOwn(sample, "contentType")
    ? sample.contentType
    : "application/json";
  if (contentType !== null && body !== null)
    headers.set("Content-Type", contentType ?? "application/json");
  return new Response(body, { status, headers });
}

test("the CLI plan reader conforms to every public plan fixture case", async () => {
  const contract = await fixture();
  assert.equal(contract.schemaVersion, 1);
  for (const sample of contract.cases.filter(
    ({ step }) => step === undefined || step === "plan",
  )) {
    const read = requestUploadPlan(
      { endpoint: contract.endpoint, token: "secret" },
      Buffer.from("plan"),
      new Set(contract.marker),
      { ...retryDependencies, fetch: async () => response(sample) },
    );
    if (sample.valid) await assert.doesNotReject(read, sample.name);
    else await assert.rejects(read, /upload-failed/, sample.name);
  }
});

test("the CLI Complete reader conforms to every public Complete fixture case", async () => {
  const contract = await fixture();
  const plan = {
    schemaVersion: 1 as const,
    upload: { id: "upload-1", expiresAt: "2026-09-26T13:00:00.000Z" },
    missing: [],
    blobUrl: `${contract.endpoint}/uploads/upload-1/{sha256}`,
    completeUrl: `${contract.endpoint}/uploads/upload-1/complete`,
  };
  for (const sample of contract.cases.filter(
    ({ step }) => step === "complete",
  )) {
    let calls = 0;
    const read = completeUpload(
      plan,
      { endpoint: contract.endpoint, token: "secret" },
      {
        ...retryDependencies,
        fetch: async () => {
          calls++;
          if (sample.outcome === "retry" && calls > 1)
            return Response.json({}, { status: 201 });
          return response(sample);
        },
      },
    );
    if (sample.valid) {
      const result = await read;
      assert.equal(result.outcome, sample.outcome, sample.name);
      assert.equal(result.viewerUrl, sample.viewerUrl, sample.name);
    } else if (sample.outcome === "replan") {
      await assert.rejects(read, ReplanRequired, sample.name);
    } else if (sample.outcome === "retry") {
      await assert.doesNotReject(read, sample.name);
      assert.equal(calls, 2, sample.name);
    } else {
      await assert.rejects(
        read,
        (error: unknown) =>
          (error as { code?: string }).code === sample.outcome,
        sample.name,
      );
    }
  }
});

test("the independent package reader covers both fixture steps", async () => {
  const reader = (await import(
    pathToFileURL(path.join(repositoryRoot, "scripts/package/upload_plan.mjs"))
      .href
  )) as { checkUploadPlanFixtures(root: string): Promise<void> };
  await reader.checkUploadPlanFixtures(repositoryRoot);
});
