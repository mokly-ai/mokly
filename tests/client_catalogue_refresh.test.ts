import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { readCatalogue } from "@mokly/viewer";
import type {
  ViewerCapabilityDescriptor,
  ViewerCapabilityRequest,
} from "@mokly/viewer/runtime";

import type { ReactCapabilityEnvironment } from "../dist/client/react_capabilities.js";
import { createReactUpdateCapability } from "../dist/client/react_capability_updates.js";

const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync("docs/protocol/fixtures/catalogue-v1.json", "utf8"),
  ),
);

/** Abort as the paired page body finishes must not adopt either evidence half. */
test("React live refresh fences a page response that finishes after cancellation", async () => {
  const initial = descriptor(2, catalogue.revision.evidence);
  const nextCatalogue = structuredClone(catalogue);
  nextCatalogue.revision.evidence += 1;
  const next = descriptor(3, nextCatalogue.revision.evidence);
  const environment = new FakeEnvironment(next, nextCatalogue);
  const subscription = new AbortController();
  environment.abort = () => subscription.abort();
  let adopted = 0;
  createReactUpdateCapability(initial, environment).subscribe(
    request(initial),
    {
      adoptEvidence: () => {
        adopted += 1;
        return true;
      },
      captureRecovery: () => undefined,
    },
    subscription.signal,
  );

  environment.source.emit("update", "3");
  await setImmediate();
  await setImmediate();

  assert.equal(adopted, 0);
  assert.equal(environment.location.reloads, 0);
  assert.equal(environment.source.closed, true);
});

function descriptor(
  updateVersion: number,
  evidenceRevision: number,
): ViewerCapabilityDescriptor {
  return {
    schemaVersion: 1,
    source: {
      base: "origin/main",
      catalogueId: catalogue.identity.id,
      contentRevision: catalogue.revision.content,
      evidenceRevision,
      updateVersion,
    },
  };
}

function request(value: ViewerCapabilityDescriptor): ViewerCapabilityRequest {
  return { route: null, source: value.source };
}

class FakeSource {
  closed = false;
  private readonly listeners = new Map<
    string,
    (event: { data: string }) => void
  >();

  addEventListener(
    type: "ready" | "update",
    callback: (event: { data: string }) => void,
  ): void {
    this.listeners.set(type, callback);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: "ready" | "update", data: string): void {
    this.listeners.get(type)?.({ data });
  }
}

class FakeStorage {
  getItem(): string | null {
    return null;
  }
  removeItem(): void {}
  setItem(): void {}
}

class FakeEnvironment implements ReactCapabilityEnvironment {
  abort = (): void => undefined;
  readonly source = new FakeSource();
  readonly storage = new FakeStorage();
  readonly location = {
    href: "http://localhost/view/screens/home.html",
    reloads: 0,
    reload() {
      this.reloads += 1;
    },
  };
  constructor(
    private readonly next: ViewerCapabilityDescriptor,
    private readonly nextCatalogue: unknown,
  ) {}

  createEventSource(): FakeSource {
    return this.source;
  }

  fetch = async (): Promise<Response> => {
    return {
      ok: true,
      url: this.location.href,
      text: async () => {
        this.abort();
        return "<html></html>";
      },
    } as Response;
  };

  onPageHide(): () => void {
    return () => undefined;
  }

  parseDocument(): Document {
    return {
      querySelector: (selector: string) => ({
        textContent: JSON.stringify(
          selector.includes("data-mokly-shell-bootstrap")
            ? shellBootstrap(this.next, this.nextCatalogue)
            : this.next,
        ),
      }),
    } as unknown as Document;
  }
}

function shellBootstrap(
  descriptor: ViewerCapabilityDescriptor,
  model: unknown,
) {
  return {
    catalogue: model,
    context: {
      base: descriptor.source.base,
      comparisons: false,
      contentVersion: descriptor.source.contentRevision,
      updateVersion: descriptor.source.updateVersion,
    },
    view: { kind: "home" },
  };
}
