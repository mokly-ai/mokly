import assert from "node:assert/strict";
import test from "node:test";

import { instanceKey } from "../../../tests/helpers/fake_frame.js";

import { mounted } from "./post_message_fixture.js";

test("boxModel authenticates measure replies and rejects errors and unknown keys", async () => {
  const fake = await mounted();
  const model = {
    box: { x: 10, y: 20, width: 160, height: 40 },
    border: { top: 2, right: 2, bottom: 2, left: 2 },
    padding: { top: 6, right: 12, bottom: 6, left: 12 },
  };
  const result = fake.mounted.boxModel!(instanceKey);
  assert.deepEqual(JSON.parse(fake.posts.at(-1)!.data), {
    channel: "mokly-frame-probe",
    version: 4,
    nonce: fake.sessionNonce,
    type: "measure",
    requestId: 1,
    key: instanceKey,
  });
  fake.send(
    { type: "box-model", requestId: 1, boxModel: model },
    fake.sessionNonce,
  );
  assert.deepEqual(await result, model);
  const empty = fake.mounted.boxModel!(instanceKey);
  fake.send(
    { type: "box-model", requestId: 2, boxModel: null },
    fake.sessionNonce,
  );
  assert.equal(await empty, null);
  const wrong = fake.mounted.boxModel!(instanceKey);
  fake.send({ type: "ack", requestId: 3 }, fake.sessionNonce);
  await assert.rejects(wrong, { code: "invalid-message" });
  const error = fake.mounted.boxModel!(instanceKey);
  fake.send(
    { type: "error", requestId: 4, code: "invalid-boundary" },
    fake.sessionNonce,
  );
  await assert.rejects(error, { code: "invalid-boundary" });
  const sent = fake.posts.length;
  await assert.rejects(fake.mounted.boxModel!("f".repeat(64)), {
    code: "missing-instance",
  });
  assert.equal(fake.posts.length, sent);
  const obsolete = fake.mounted.boxModel!(instanceKey);
  fake.send(
    { type: "box-model", requestId: 5, boxModel: model },
    fake.sessionNonce,
  );
  fake.mounted.dispose();
  await assert.rejects(obsolete, { code: "disposed" });
});
