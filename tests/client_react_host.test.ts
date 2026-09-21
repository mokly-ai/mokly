import assert from "node:assert/strict";
import test from "node:test";

import { viewerCapabilityRequest } from "@mokly/viewer/runtime";

import {
  startReactHost,
  type ReactHostWindow,
} from "../dist/client/react_host.js";

const descriptor = {
  schemaVersion: 1,
  source: {
    base: "origin/main",
    catalogueId: "a".repeat(64),
    contentRevision: 0,
    evidenceRevision: 0,
    updateVersion: 1,
  },
};

test("live host hydrates when EventSource and session storage are unavailable", () => {
  const warnings: unknown[][] = [];
  const win = fakeWindow(warnings, {
    sessionStorage: () => {
      throw new Error("storage denied");
    },
  });
  let hydrations = 0;
  startReactHost(fakeDocument(), win, (_document, capabilities) => {
    hydrations += 1;
    const request = viewerCapabilityRequest(capabilities.source, null);
    assert.equal(capabilities.updates.consumeRecovery(request), undefined);
    capabilities.updates.subscribe(
      request,
      actions(),
      new AbortController().signal,
    );
  });
  assert.equal(hydrations, 1);
  assert.equal(warnings.length, 1);
});

test("live host isolates throwing stream and recovery storage adapters", () => {
  const warnings: unknown[][] = [];
  const storage = {
    getItem() {
      throw new Error("storage read failed");
    },
    removeItem() {},
    setItem() {},
  } as unknown as Storage;
  class ThrowingEventSource {
    constructor() {
      throw new Error("stream failed");
    }
  }
  const win = fakeWindow(warnings, {
    eventSource: ThrowingEventSource as unknown as typeof EventSource,
    sessionStorage: () => storage,
  });
  let hydrations = 0;
  startReactHost(fakeDocument(), win, (_document, capabilities) => {
    hydrations += 1;
    const request = viewerCapabilityRequest(capabilities.source, null);
    assert.equal(capabilities.updates.consumeRecovery(request), undefined);
    capabilities.updates.subscribe(
      request,
      actions(),
      new AbortController().signal,
    );
  });
  assert.equal(hydrations, 1);
  assert.equal(warnings.length, 2);
});

function fakeDocument(): Document {
  return {
    querySelector: () => ({ textContent: JSON.stringify(descriptor) }),
  } as unknown as Document;
}

function fakeWindow(
  warnings: unknown[][],
  options: {
    eventSource?: typeof EventSource;
    sessionStorage: () => Storage;
  },
): ReactHostWindow {
  return {
    DOMParser: class {} as typeof DOMParser,
    ...(options.eventSource ? { EventSource: options.eventSource } : {}),
    addEventListener() {},
    console: { warn: (...values) => warnings.push(values) },
    fetch: async () => {
      throw new Error("unused");
    },
    location: {
      href: "http://localhost/",
      reload() {},
    } as Location,
    removeEventListener() {},
    get sessionStorage() {
      return options.sessionStorage();
    },
  };
}

function actions() {
  return {
    adoptEvidence: async () => true,
    captureRecovery: () => undefined,
  };
}
