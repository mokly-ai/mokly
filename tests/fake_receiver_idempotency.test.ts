import assert from "node:assert/strict";
import test from "node:test";

import type { PlanResponse } from "../dist/publish/types.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import {
  fakeCompleteRequest,
  fakePlanArchive,
  fakePlanRequest,
  uploadFakePlanBlobs,
} from "./helpers/fake_receiver_fixture.js";
import { runPublishedCli } from "./helpers/publish_process.js";

const token = "idempotent-receiver-token";

test("overlapping uploads keep the publication that completes first", async (context) => {
  const receiver = await startFakeReceiver(context, { token });
  const fixture = await fakePlanArchive();
  const first = (await (
    await fakePlanRequest(receiver.endpoint, fixture.archive, token)
  ).json()) as PlanResponse;
  const second = (await (
    await fakePlanRequest(receiver.endpoint, fixture.archive, token)
  ).json()) as PlanResponse;
  await uploadFakePlanBlobs(first, fixture, token);

  const firstComplete = await fakeCompleteRequest(first.completeUrl, token);
  const firstBody = await firstComplete.text();
  receiver.dropBlob(first.missing[0]!);
  const secondComplete = await fakeCompleteRequest(second.completeUrl, token);
  assert.equal(firstComplete.status, 201);
  assert.equal(secondComplete.status, 200);
  assert.equal(await secondComplete.text(), firstBody);
  assert.equal(receiver.publications.size, 1);
  assert.equal(JSON.parse(firstBody).id, "publication-1");
});

test("repeated Complete replays the same 201 status and exact body", async (context) => {
  const receiver = await startFakeReceiver(context, { token });
  const fixture = await fakePlanArchive();
  const planned = (await (
    await fakePlanRequest(receiver.endpoint, fixture.archive, token)
  ).json()) as PlanResponse;
  await uploadFakePlanBlobs(planned, fixture, token);

  const first = await fakeCompleteRequest(planned.completeUrl, token);
  const firstBody = await first.text();
  const repeated = await fakeCompleteRequest(planned.completeUrl, token);
  assert.equal(first.status, 201);
  assert.equal(repeated.status, 201);
  assert.equal(await repeated.text(), firstBody);
  assert.equal(receiver.publications.size, 1);
});

test("a dropped first Complete response retries one completed upload", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token });
  receiver.control.dropCompleteResponses = 1;

  const result = await runPublishedCli(fixture.root, receiver.endpoint, token, [
    "--no-changes",
  ]);
  assert.match(result.stdout, /^Published Mokly catalogue\./u);
  assert.equal(result.stderr, "");
  assert.equal(receiver.publications.size, 1);
  const completes = receiver.requests.filter(({ kind }) => kind === "complete");
  assert.equal(completes.length, 2);
  assert.deepEqual(
    completes.map(({ status }) => status),
    [201, 201],
  );
});
