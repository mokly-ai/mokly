import assert from "node:assert/strict";
import test from "node:test";

import { fingerprintReplayReader } from "./helpers/fingerprint_replay_reader.mjs";

test("catalogue replay observes original batching and reuses checked bytes", async () => {
  const bytes = Buffer.from("sheet");
  let batches = 0;
  const reader = fingerprintReplayReader({
    read: async () => {
      throw new Error("must not add a single read");
    },
    readMany: async (routes: readonly string[]) => {
      batches++;
      return new Map(routes.map((route) => [route, bytes]));
    },
    readManyIfExists: async () => {
      throw new Error("must not add an optional read");
    },
  });
  assert.deepEqual(
    await reader.observed.readMany!(["shared.css"]),
    new Map([["shared.css", bytes]]),
  );
  bytes.fill(0);
  assert.equal(
    Buffer.from(await reader.replay.read("shared.css")).toString(),
    "sheet",
  );
  const optional = await reader.replay.readIfExists!("shared.css");
  assert.ok(optional);
  assert.equal(Buffer.from(optional).toString(), "sheet");
  assert.equal(batches, 1);
});

test("a replayed optional absence preserves the required-reader failure", async () => {
  const failure = new Error("required fixture failure");
  let reads = 0;
  const reader = fingerprintReplayReader({
    read: async () => {
      reads++;
      throw failure;
    },
    readIfExists: async () => undefined,
  });
  assert.equal(await reader.replay.readIfExists!("missing.svg"), undefined);
  await assert.rejects(
    reader.replay.read("missing.svg"),
    (error: unknown) => error === failure,
  );
  await assert.rejects(
    reader.replay.read("missing.svg"),
    (error: unknown) => error === failure,
  );
  assert.equal(reads, 1);
});
