import assert from "node:assert/strict";
import test from "node:test";

import { completed } from "./helpers/mokly_serve.js";

for (const status of ["pending", "preparing"]) {
  test(`live-prop fixtures wait for Changes while usage is ready and ${status}`, async () => {
    let notifyRead!: () => void;
    const reading = new Promise<void>((resolve) => {
      notifyRead = resolve;
    });
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const events = new ReadableStream<Uint8Array>(
      {
        start(value) {
          controller = value;
        },
        pull() {
          notifyRead();
        },
      },
      { highWaterMark: 0 },
    );
    const state = { revision: 1, status };
    const request: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/events")) return new Response(events);
      if (url.endsWith("/index.json"))
        return Response.json({
          revision: state.revision,
          changesStatus: state.status,
        });
      assert.ok(url.endsWith("/entries/card.json"));
      return Response.json({
        revision: state.revision,
        workspace: { usedBy: [] },
      });
    };
    const result = completed(
      "http://fixture",
      new AbortController().signal,
      "card",
      request,
    );
    assert.equal(
      await Promise.race([
        result.then(() => "finished"),
        reading.then(() => "waiting"),
      ]),
      "waiting",
    );
    state.revision = 2;
    state.status = "unavailable";
    controller.enqueue(new TextEncoder().encode("id: 2\ndata: process\n\n"));
    const { index, detail } = await result;
    assert.equal(index.changesStatus, "unavailable");
    assert.equal(index.revision, 2);
    assert.equal(detail.revision, 2);
  });
}

test("live-prop fixtures settle on a current variant workspace", async () => {
  const events = new ReadableStream<Uint8Array>();
  const request: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/events")) return new Response(events);
    if (url.endsWith("/index.json"))
      return Response.json({ revision: 1, changesStatus: "disabled" });
    assert.ok(url.endsWith("/entries/card/disabled.json"));
    return Response.json({ revision: 1, workspace: {} });
  };
  const result = await completed(
    "http://fixture",
    new AbortController().signal,
    "card/disabled",
    request,
  );
  assert.equal(result.detail.revision, 1);
});
