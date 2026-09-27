import assert from "node:assert/strict";
import test from "node:test";

import { createEvidenceGithub } from "../scripts/release/evidence_github.mjs";

import {
  TAG_COMMIT,
  verificationArtifacts,
} from "./helpers/release_evidence.js";

test("GitHub transport failures are typed as absent", async () => {
  for (const fetch of [
    async () => {
      throw new Error("network reset");
    },
    async () => new Response("unavailable", { status: 503 }),
  ]) {
    const github = createEvidenceGithub({
      token: "secret",
      repository: "mokly-ai/mokly",
      serverUrl: "https://github.com",
      fetch,
    });
    const result = await github.listPulls(TAG_COMMIT);
    assert.equal(result.outcome, "absent");
    assert.ok(result.reason);
    assert.match(result.reason, /failed|503/);
  }
});

test("artifact redirects never forward the workflow token", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const writes: Array<{ bytes: Uint8Array; file: string }> = [];
  const commands: Array<{ args: string[]; command: string }> = [];
  const fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    requests.push({ url: String(input), ...(init ? { init } : {}) });
    if (requests.length === 1)
      return new Response(null, {
        status: 302,
        headers: { location: "https://objects.example.test/report.zip" },
      });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  };
  const github = createEvidenceGithub({
    token: "workflow-secret",
    repository: "mokly-ai/mokly",
    serverUrl: "https://github.com",
    fetch,
    write: async (file: string, bytes: Uint8Array) => {
      writes.push({ file, bytes });
    },
    execute: async (command: string, args: string[]) => {
      commands.push({ command, args });
      return { stdout: "", stderr: "" };
    },
  });
  const result = await github.downloadArtifact(
    verificationArtifacts()[0]!,
    "/tmp/reports/verification-report-1",
  );
  assert.equal(result.outcome, "applicable");
  assert.equal(
    new Headers(requests[0]?.init?.headers).get("authorization"),
    "Bearer workflow-secret",
  );
  assert.equal(
    new Headers(requests[1]?.init?.headers).get("authorization"),
    null,
  );
  assert.equal(writes.length, 1);
  assert.deepEqual(commands[0]?.args.slice(0, 2), ["-o", "-q"]);
});
