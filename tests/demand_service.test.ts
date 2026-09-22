import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { DocumentCache } from "../dist/build/document_cache.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { DocumentService } from "../dist/server/demand/service.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

class FakeWorker extends EventEmitter {
  readonly requests: string[] = [];
  terminated = false;
  termination: Promise<number> = Promise.resolve(0);
  postMessage(route: string): void {
    this.requests.push(route);
  }
  async terminate(): Promise<number> {
    this.terminated = true;
    return this.termination;
  }
  respond(): void {
    const route = this.requests.at(-1)!;
    this.emit("message", { ok: true, document: { route, html: route } });
  }
}

test("demand worker coalesces, recovers after idle failure and keeps listeners bounded", async (t) => {
  const fixture = await createFixture(validEntrySource());
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const workers: FakeWorker[] = [];
  const busy: boolean[] = [];
  const service = new DocumentService(runtime, (active) => busy.push(active), {
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  fixture.beforeRemove(() => service.close());
  const first = service.read("screens/home.desktop.html");
  assert.equal(service.read("screens/home.desktop.html"), first);
  workers[0]!.respond();
  await first;
  assert.deepEqual(busy, [true, false]);
  assert.equal(workers[0]!.listenerCount("error"), 1);
  workers[0]!.emit("error", new Error("idle failure"));
  workers[0]!.emit("exit", 1);
  const next = service.read("screens/home.mobile.html");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(workers.length, 2);
  workers[1]!.respond();
  await next;
  assert.equal(workers[1]!.listenerCount("error"), 1);
  await service.read("screens/home.desktop.html");
  assert.equal(workers[1]!.requests.length, 1);
});

test("a failed renderer terminates before its replacement starts", async (t) => {
  const fixture = await createFixture(validEntrySource());
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const workers: FakeWorker[] = [];
  let release: () => void = () => {};
  const termination = new Promise<number>((resolve) => {
    release = () => resolve(0);
  });
  const service = new DocumentService(runtime, () => {}, {
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      if (workers.length === 1) worker.termination = termination;
      return worker;
    },
  });
  fixture.beforeRemove(async () => {
    release();
    await service.close();
  });
  const first = assert.rejects(
    service.read("screens/home.desktop.html"),
    /failed/,
  );
  workers[0]!.emit("error", new Error("failed"));
  await first;
  const next = service.read("screens/home.mobile.html");
  void next.catch(() => {});
  assert.equal(workers.length, 1);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(workers.length, 2);
  workers[1]!.respond();
  await next;
});

test("demand admission, deadline and shutdown reject work without poisoning a replacement", async (t) => {
  const fixture = await createFixture(validEntrySource());
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const workers: FakeWorker[] = [];
  const service = new DocumentService(runtime, () => {}, {
    timeoutMs: 20,
    maxQueued: 1,
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  fixture.beforeRemove(() => service.close());
  const active = assert.rejects(
    service.read("screens/home.desktop.html"),
    /too long/,
  );
  const queued = service.read("screens/home.mobile.html");
  await assert.rejects(service.read("screens/details.desktop.html"), /busy/);
  await active;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(workers[0]!.terminated, true);
  assert.equal(workers.length, 2);
  const stopped = assert.rejects(queued, /stopped/);
  await service.close();
  await stopped;
  await assert.rejects(service.read("screens/home.desktop.html"), /closed/);
});

test("document cache bounds bytes and evicts least recently used documents", () => {
  const cache = new DocumentCache<string>(6, (value) => value.length);
  cache.set("a", "aaa");
  cache.set("b", "bbb");
  assert.equal(cache.get("a"), "aaa");
  cache.set("c", "ccc");
  assert.equal(cache.get("b"), undefined);
  cache.set("large", "1234567");
  assert.equal(cache.get("large"), undefined);
  assert.equal(cache.get("c"), "ccc");
  cache.clear();
  assert.equal(cache.get("c"), undefined);
});
