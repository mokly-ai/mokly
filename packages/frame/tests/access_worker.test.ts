import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { accessStartPath } from "../src/access/paths.js";
import { tokenStorageFailed, tokenStored } from "../src/access/worker_ack.js";

import {
  accessWorker,
  frameOrigin,
  tokenDatabase,
} from "./access_worker_fixture.js";

const code = await fs.readFile(
  new URL("../dist/browser/access-worker.js", import.meta.url),
  "utf8",
);
const token = (token: string, expiresAt: number) =>
  JSON.stringify({
    channel: "mokly-frame-access",
    version: 1,
    type: "token",
    token,
    expiresAt,
  });
const screen = `${frameOrigin}/static/screen.html`;

test("the worker confirms committed storage and keeps the newest own-window token across restarts", async () => {
  const storage = tokenDatabase();
  const worker = accessWorker(code, storage);
  assert.equal(await worker.install(), 1);
  assert.equal(
    worker.send(token("foreign", 20), "https://other.test"),
    undefined,
  );
  assert.equal(
    worker.send(token("nested-worker", 20), frameOrigin, "worker"),
    undefined,
  );
  assert.equal(
    worker.send(token("transfer", 20), frameOrigin, "window", [{}]),
    undefined,
  );
  assert.equal(worker.send(token("bad token", 20)), undefined);
  assert.deepEqual(worker.acknowledgements, []);
  await Promise.all([
    worker.send(token("newest", 10)),
    worker.send(token("older", 9)),
  ]);
  assert.deepEqual(storage.writes, [{ token: "newest", expiresAt: 10 }]);
  assert.deepEqual(worker.acknowledgements, [
    { data: tokenStored, writes: 1 },
    { data: tokenStored, writes: 1 },
  ]);
  const restarted = accessWorker(code, storage);
  await restarted.fetch(new Request(screen));
  assert.equal(
    restarted.requests[0]?.headers.get("Authorization"),
    "Bearer newest",
  );
  storage.abortNextTransaction();
  await restarted.send(token("uncertain", 11));
  assert.deepEqual(restarted.acknowledgements, [
    { data: tokenStorageFailed, writes: 1 },
  ]);
});

test("the worker reports storage failure when a successful put is rolled back", async () => {
  const storage = tokenDatabase();
  const worker = accessWorker(code, storage);
  storage.abortNextTransaction("after-put");
  await worker.send(token("uncommitted", 10));
  assert.equal(storage.abortedPuts, 1);
  assert.deepEqual(worker.acknowledgements, [
    { data: tokenStorageFailed, writes: 0 },
  ]);
});

test("the worker adds the header only for its exact origin and preserves credentials and existing authorization", async () => {
  const worker = accessWorker(code);
  await worker.send(token("secret", 10));
  for (const url of [
    "https://other.test/image.png",
    "https://frames.test:8443/image.png",
    "http://frames.test/image.png",
  ])
    assert.equal(worker.fetch(new Request(url)), undefined);
  const documentAsset = new Request(`${frameOrigin}/image.png`, {
    mode: "no-cors",
    credentials: "same-origin",
  });
  await worker.fetch(documentAsset);
  assert.equal(
    worker.requests[0]?.headers.get("Authorization"),
    "Bearer secret",
  );
  assert.equal(worker.requests[0]?.credentials, "same-origin");
  assert.equal(worker.requests[0]?.mode, "same-origin");
  for (const header of ["Bearer caller-token", ""]) {
    const request = new Request(screen, {
      headers: { Authorization: header },
      credentials: "include",
    });
    await worker.fetch(request);
    assert.equal(worker.requests.at(-1), request);
    assert.equal(worker.requests.at(-1)?.headers.get("Authorization"), header);
    assert.equal(worker.requests.at(-1)?.credentials, "include");
  }
});

test("the worker fetches a navigation with its body and redirect mode and replaces its 401 with the public start page", async () => {
  const start = new Response("<script>start();</script>", {
    headers: { "Content-Type": "text/html" },
  });
  const worker = accessWorker(code, tokenDatabase(), (request) =>
    request.url === frameOrigin + accessStartPath
      ? start
      : new Response(null, { status: 401 }),
  );
  await worker.send(token("old", 10));
  const navigation = new Request(screen, {
    method: "POST",
    body: "value",
    credentials: "include",
    redirect: "manual",
  });
  Object.defineProperty(navigation, "mode", { value: "navigate" });
  assert.equal(await worker.fetch(navigation), start);
  const [outgoing, fallback] = worker.requests;
  assert.equal(outgoing?.url, screen);
  assert.equal(outgoing?.mode, "same-origin");
  assert.equal(outgoing?.redirect, "manual");
  assert.equal(outgoing?.credentials, "include");
  assert.equal(outgoing?.headers.get("Authorization"), "Bearer old");
  assert.equal(await outgoing?.text(), "value");
  assert.equal(fallback?.url, frameOrigin + accessStartPath);
  assert.equal(fallback?.headers.has("Authorization"), false);
  for (let index = 0; index < 2; index++)
    assert.equal((await worker.fetch(new Request(screen)))?.status, 401);
  assert.deepEqual(
    worker.requests.map(({ url }) => url),
    [screen, frameOrigin + accessStartPath, screen, screen],
  );
});
