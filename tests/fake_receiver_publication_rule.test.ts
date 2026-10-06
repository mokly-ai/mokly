import assert from "node:assert/strict";
import test from "node:test";

import type { PlanResponse } from "../dist/publish/types.js";

import { startFakeReceiver } from "./helpers/fake_receiver.js";
import {
  fakeCompleteRequest,
  fakePlanArchive,
  fakePlanRequest,
  uploadFakePlanBlobs,
} from "./helpers/fake_receiver_fixture.js";

const token = "publication-rule-token";
const key = `${"a".repeat(40)}\0mokly.config.ts`;

async function publish(
  receiver: Awaited<ReturnType<typeof startFakeReceiver>>,
  options: { uncommittedChanges?: boolean; pageText?: string } = {},
) {
  const fixture = await fakePlanArchive(options);
  const plan = (await (
    await fakePlanRequest(receiver.endpoint, fixture.archive, token)
  ).json()) as PlanResponse;
  await uploadFakePlanBlobs(plan, fixture, token);
  const completed = await fakeCompleteRequest(plan.completeUrl, token);
  return {
    body: (await completed.json()) as { id: string },
    missing: plan.missing,
    status: completed.status,
  };
}

test("a clean replay of a clean publication joins it", async (context) => {
  const receiver = await startFakeReceiver(context, { token });
  const first = await publish(receiver);
  const replay = await publish(receiver, { pageText: "edited later" });
  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.missing, []);
  assert.deepEqual(replay.body, first.body);
  assert.equal(receiver.publications.get(key)?.body["id"], first.body.id);
  assert.equal(receiver.dirtyPublications.length, 0);
});

test("a dirty publication never claims or joins a commit", async (context) => {
  const receiver = await startFakeReceiver(context, { token });
  const dirty = await publish(receiver, {
    uncommittedChanges: true,
    pageText: "first local edit",
  });
  assert.equal(dirty.status, 201);
  assert.equal(receiver.publications.size, 0);

  const clean = await publish(receiver);
  assert.equal(clean.status, 201);
  assert.notEqual(clean.body.id, dirty.body.id);
  assert.equal(receiver.publications.get(key)?.body["id"], clean.body.id);

  const later = await publish(receiver, {
    uncommittedChanges: true,
    pageText: "second local edit",
  });
  assert.equal(later.status, 201);
  assert.equal(later.missing.length, 1);
  assert.notEqual(later.body.id, clean.body.id);
  assert.equal(receiver.publications.get(key)?.body["id"], clean.body.id);

  const repeated = await publish(receiver, {
    uncommittedChanges: true,
    pageText: "second local edit",
  });
  assert.equal(repeated.status, 201);
  assert.notEqual(repeated.body.id, later.body.id);
  assert.deepEqual(
    receiver.dirtyPublications.map(({ body }) => body["id"]),
    [dirty.body.id, later.body.id, repeated.body.id],
  );
});

test("overlapping dirty uploads each create a publication", async (context) => {
  const receiver = await startFakeReceiver(context, { token });
  const fixture = await fakePlanArchive({ uncommittedChanges: true });
  const first = (await (
    await fakePlanRequest(receiver.endpoint, fixture.archive, token)
  ).json()) as PlanResponse;
  const second = (await (
    await fakePlanRequest(receiver.endpoint, fixture.archive, token)
  ).json()) as PlanResponse;
  await uploadFakePlanBlobs(first, fixture, token);
  const firstComplete = await fakeCompleteRequest(first.completeUrl, token);
  const secondComplete = await fakeCompleteRequest(second.completeUrl, token);
  assert.equal(firstComplete.status, 201);
  assert.equal(secondComplete.status, 201);
  assert.notEqual(await firstComplete.text(), await secondComplete.text());
  assert.equal(receiver.publications.size, 0);
  assert.equal(receiver.dirtyPublications.length, 2);
});
