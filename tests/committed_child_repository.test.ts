import assert from "node:assert/strict";
import test from "node:test";

import { runServerChild } from "../dist/server/child.js";
import { childUpdateMessage } from "../dist/server/update_messages.js";

import { nestedRepository } from "./helpers/nested_repository.js";

test("committed child rejects a nested repoRoot on the unselected comparison route", async (t) => {
  const { config, compilation } = await nestedRepository(t);
  const descriptor = Object.getOwnPropertyDescriptor(process, "send");
  let resolveReady: (port: number) => void = () => {};
  let rejectReady: (error: unknown) => void = () => {};
  const ready = new Promise<number>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  Object.defineProperty(process, "send", {
    configurable: true,
    value: (message: { type: string; port: number }) => {
      if (message.type === "ready") resolveReady(message.port);
    },
  });
  const running = runServerChild(
    config,
    0,
    "HEAD",
    1,
    false,
    false,
    compilation.manifest,
  );
  void running.catch(rejectReady);
  try {
    const port = await ready;
    const commit = "a".repeat(40);
    process.emit(
      "message",
      childUpdateMessage(
        2,
        undefined,
        undefined,
        "pending",
        "evidence",
        commit,
        "blobs",
      ),
      undefined,
    );
    const response = await fetch(
      `http://127.0.0.1:${port}/__mokly/diffs/review.json`,
    );
    assert.equal(response.status, 500);
    const failure = (await response.json()) as { details: string };
    assert.match(failure.details, /\[mokly\/config-invalid\]/);
    assert.match(failure.details, /repoRoot.*Git top level/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
  } finally {
    process.emit("message", { type: "shutdown" }, undefined);
    await running;
    if (descriptor) Object.defineProperty(process, "send", descriptor);
    else delete process.send;
  }
});
