import assert from "node:assert/strict";
import test from "node:test";

import type {
  ViewerCapabilityDescriptor,
  ViewerCapabilityRequest,
} from "@mokly/viewer/runtime";
import {
  readInteractivePrepareResponse,
  readViewerInteractiveDescriptor,
} from "@mokly/viewer/runtime";

import {
  createReactViewerCapabilities,
  type ReactCapabilityEnvironment,
} from "../dist/client/react_capabilities.js";

const generation = "a".repeat(32);
const descriptor: ViewerCapabilityDescriptor = {
  interactive: {
    generation,
    origin: "https://live.example.test",
    port: 4174,
    state: "idle",
  },
  schemaVersion: 1,
  source: {
    base: "origin/main",
    catalogueId: "b".repeat(64),
    contentRevision: 1,
    evidenceRevision: 1,
    updateVersion: 1,
  },
};

test("private Live descriptor and preparation responses validate exactly", () => {
  assert.deepEqual(
    readViewerInteractiveDescriptor(descriptor.interactive),
    descriptor.interactive,
  );
  for (const invalid of [
    { ...descriptor.interactive, port: 0 },
    { ...descriptor.interactive, state: "preparing" },
    { ...descriptor.interactive, extra: true },
    { ...descriptor.interactive, origin: "https://live.example.test/" },
    { ...descriptor.interactive, generation: "not-safe" },
  ])
    assert.throws(
      () => readViewerInteractiveDescriptor(invalid),
      /Invalid live viewer interactive descriptor/,
    );
  assert.deepEqual(
    readInteractivePrepareResponse({ generation, state: "ready" }),
    { generation, state: "ready" },
  );
  assert.throws(
    () =>
      readInteractivePrepareResponse({
        generation,
        state: "building",
      }),
    /Invalid live viewer interactive preparation response/,
  );
});

test("private Live preparation uses the app origin and validates status", async () => {
  const environment = new InteractiveEnvironment();
  const capability = createReactViewerCapabilities(
    descriptor,
    environment,
  ).interactive;
  assert.ok(capability);
  const response = await capability.prepare(
    request(),
    generation,
    new AbortController().signal,
  );
  assert.deepEqual(response, { generation, state: "ready" });
  assert.equal(
    environment.requested?.url,
    `http://127.0.0.1:4173/__mokly/interactive/${generation}/prepare`,
  );
  assert.equal(environment.requested?.init?.method, "POST");

  environment.status = 503;
  environment.state = "failed";
  assert.deepEqual(
    await capability.prepare(
      request(),
      generation,
      new AbortController().signal,
    ),
    { generation, state: "failed" },
  );
  await assert.rejects(
    capability.prepare(request(), "c".repeat(32), new AbortController().signal),
    /generation changed/,
  );
});

test("private Live event updates advance state only for stable identity", () => {
  const environment = new InteractiveEnvironment();
  const updates: string[] = [];
  const controller = new AbortController();
  createReactViewerCapabilities(descriptor, environment).updates.subscribe(
    request(),
    {
      adoptEvidence: () => true,
      adoptInteractive: (interactive) => updates.push(interactive.state),
      captureRecovery: () => undefined,
    },
    controller.signal,
  );
  environment.source.emit("interactive", {
    ...descriptor.interactive!,
    state: "building",
  });
  environment.source.emit("interactive", {
    ...descriptor.interactive!,
    port: 9999,
    state: "ready",
  });
  assert.deepEqual(updates, ["building"]);
  controller.abort();
  assert.equal(environment.source.closed, true);
});

function request(): ViewerCapabilityRequest {
  return { entryPath: null, source: descriptor.source };
}

class InteractiveSource {
  closed = false;
  private readonly listeners = new Map<
    string,
    (event: { data: string }) => void
  >();

  addEventListener(
    type: "interactive" | "ready" | "update",
    callback: (event: { data: string }) => void,
  ): void {
    this.listeners.set(type, callback);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: "interactive", value: unknown): void {
    this.listeners.get(type)?.({ data: JSON.stringify(value) });
  }
}

class InteractiveEnvironment implements ReactCapabilityEnvironment {
  readonly source = new InteractiveSource();
  readonly storage = {
    getItem: () => null,
    removeItem: () => undefined,
    setItem: () => undefined,
  };
  readonly location = {
    href: "http://127.0.0.1:4173/view/home/",
    reload: () => undefined,
  };
  requested: { init?: RequestInit; url: string } | undefined;
  state: "failed" | "ready" = "ready";
  status = 200;

  createEventSource(): InteractiveSource {
    return this.source;
  }

  fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    this.requested = { ...(init ? { init } : {}), url: String(input) };
    return {
      json: async () => ({ generation, state: this.state }),
      status: this.status,
    } as Response;
  };

  onPageHide(): () => void {
    return () => undefined;
  }

  parseDocument(): Document {
    throw new Error("unused");
  }
}
