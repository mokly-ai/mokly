import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { RenderQueue } from "../dist/server/controls/queue.js";
import type { TransientRender } from "../dist/server/controls/transient_assets.js";
import type {
  RenderWorker,
  RenderWorkerFactory,
} from "../dist/server/controls/worker_client.js";
import type { ComponentRenderRequest } from "../packages/viewer/dist/components/render_types.js";

const result = { route: "result" } as TransientRender;
const request = (id: number): ComponentRenderRequest => ({
  componentId: "action",
  variantId: "default",
  viewport: "desktop",
  colorScheme: "light",
  generation: "g",
  pageId: String(id).padStart(32, "0"),
  overrides: {},
});
class ControlledWorkers implements RenderWorkerFactory {
  jobs: {
    request: ComponentRenderRequest;
    resolve(value: TransientRender): void;
  }[] = [];
  closed = 0;
  created = 0;
  create(): RenderWorker {
    this.created++;
    return {
      render: (request) =>
        new Promise((resolve) => this.jobs.push({ request, resolve })),
      close: async () => {
        this.closed++;
      },
    };
  }
}
test("render queue caps admission, coalesces pages, cancels active work and drains replacements", async () => {
  const factory = new ControlledWorkers();
  const queue = new RenderQueue(factory);
  const signal = new AbortController().signal;
  const active = queue.render(request(0), signal);
  const pending = Array.from({ length: 8 }, (_, i) =>
    queue.render(request(i + 1), signal),
  );
  await assert.rejects(queue.render(request(9), signal), { code: "capacity" });
  const replaced = assert.rejects(pending[0]!, { code: "cancelled" });
  const replacement = queue.render(request(1), signal);
  await replaced;
  factory.jobs[0]!.resolve(result);
  await active;
  for (let i = 1; i < 8; i++) {
    factory.jobs[i]!.resolve(result);
    await pending[i]!;
  }
  factory.jobs[8]!.resolve(result);
  await replacement;
  const next = queue.render(request(0), signal);
  await delay(0);
  const cancelled = assert.rejects(next, { code: "cancelled" });
  const last = queue.render(request(0), signal);
  await cancelled;
  factory.jobs.at(-1)!.resolve(result);
  await last;
  await queue.close();
  assert.ok(factory.closed >= 2);
});
test("timeout replaces the worker and shutdown rejects active and queued work", async () => {
  const factory = new ControlledWorkers();
  const queue = new RenderQueue(factory, 15);
  await assert.rejects(queue.render(request(1), new AbortController().signal), {
    code: "render-failed",
  });
  const active = queue.render(request(2), new AbortController().signal);
  await delay(0);
  factory.jobs.at(-1)!.resolve(result);
  await active;
  assert.equal(factory.created, 2);
  const controller = new AbortController();
  const last = assert.rejects(queue.render(request(3), controller.signal), {
    code: "cancelled",
  });
  const pending = assert.rejects(queue.render(request(4), controller.signal), {
    code: "cancelled",
  });
  await queue.close();
  await Promise.all([last, pending]);
});
