import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createExportFixture } from "./helpers/export_fixture.js";
import {
  startFakeReceiver,
  type FakeRequestKind,
} from "./helpers/fake_receiver.js";
import { runPublishedCli } from "./helpers/publish_process.js";

const token = "recovery-receiver-token";

test("publish re-plans once after Complete 409 and blob or Complete 410", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const scenarios: Array<[FakeRequestKind, number]> = [
    ["complete", 409],
    ["blob", 410],
    ["complete", 410],
  ];
  for (const [kind, status] of scenarios) {
    assert.notEqual(kind, "unknown");
    const receiver = await startFakeReceiver(context, { token });
    receiver.queue(kind as "blob" | "complete", { status });
    const { stdout, stderr } = await runPublishedCli(
      fixture.root,
      receiver.endpoint,
      token,
      ["--no-changes"],
    );
    assert.match(stdout, /^Published Mokly catalogue\./u, `${kind} ${status}`);
    assert.equal(stderr, "", `${kind} ${status}`);
    assert.equal(receiver.plans.length, 2, `${kind} ${status}`);
    assert.equal(
      receiver.requests.filter((request) => request.kind === "plan").length,
      2,
      `${kind} ${status}`,
    );
  }
});

test("local expiry gets one new plan and a second expiry fails safely", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const recovered = await startFakeReceiver(context, { token });
  recovered.control.expiryMs.push(-1, 60 * 60 * 1_000);
  const success = await runPublishedCli(
    fixture.root,
    recovered.endpoint,
    token,
    ["--no-changes"],
  );
  assert.match(success.stdout, /^Published Mokly catalogue\./u);
  assert.equal(success.stderr, "");
  assert.equal(recovered.plans.length, 2);

  const expired = await startFakeReceiver(context, { token });
  expired.control.expiryMs.push(-1, -1);
  await assert.rejects(
    runPublishedCli(fixture.root, expired.endpoint, token, ["--no-changes"]),
    (error: unknown) => {
      const output = error as { stdout: string; stderr: string };
      assert.equal(output.stdout, "");
      assert.equal(
        output.stderr,
        "[mokly/upload-failed] The catalogue could not be uploaded. Check the endpoint and connection, then retry.\n",
      );
      assert.doesNotMatch(output.stderr, new RegExp(token, "u"));
      return true;
    },
  );
  assert.equal(expired.plans.length, 2);
  await assertCompleteExport(path.join(fixture.root, "site"));
});

test("spawned publish retries every retryable status immediately and honors concurrency one", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token });
  receiver.control.blobDelayMs = 10;
  for (const status of [408, 429])
    receiver.queue("plan", { status, retryAfter: "0" });
  for (const status of [500, 502])
    receiver.queue("blob", { status, retryAfter: "0" });
  for (const status of [503, 504])
    receiver.queue("complete", { status, retryAfter: "0" });
  const { stdout, stderr } = await runPublishedCli(
    fixture.root,
    receiver.endpoint,
    token,
    ["--no-changes", "--upload-concurrency=1"],
  );
  assert.match(stdout, /^Published Mokly catalogue\./u);
  assert.equal(stderr, "");
  assert.equal(receiver.maxConcurrentPuts, 1);
  for (const status of [408, 429, 500, 502, 503, 504])
    assert.ok(
      receiver.requests.some((request) => request.status === status),
      String(status),
    );
});

async function assertCompleteExport(output: string): Promise<void> {
  const marker = JSON.parse(
    await fs.readFile(path.join(output, ".mokly-export-artifact"), "utf8"),
  ) as { files: Array<{ path: string }> };
  assert.ok(marker.files.length > 0);
  for (const { path: name } of marker.files)
    assert.equal((await fs.stat(path.join(output, name))).isFile(), true, name);
}
