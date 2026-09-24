import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { readCatalogue } from "@mokly/viewer";
import type {
  ViewerCapabilityDescriptor,
  ViewerCapabilityRequest,
} from "@mokly/viewer/runtime";
import type { WorkspaceData } from "@mokly/viewer/server";

import {
  createReactViewerCapabilities,
  type ReactCapabilityEnvironment,
} from "../dist/client/react_capabilities.js";

const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync("docs/protocol/fixtures/catalogue-v2.json", "utf8"),
  ),
);
const descriptor: ViewerCapabilityDescriptor = {
  schemaVersion: 1,
  source: {
    base: "origin/main",
    catalogueId: catalogue.identity.id,
    contentRevision: catalogue.revision.content,
    evidenceRevision: catalogue.revision.evidence,
    previewGeneration: "a".repeat(32),
    renderGeneration: "a".repeat(32),
    updateVersion: 4,
  },
  renderCapability: {
    generation: "a".repeat(32),
    token: "b".repeat(64),
  },
  workspace: workspaceEvidence(),
};

test("React live updates provide recovery and replace strict-effect streams", () => {
  const environment = new FakeEnvironment();
  environment.storage.setItem(
    "mokly:live-update-recovery",
    JSON.stringify({
      browse: browseRecovery(),
      url: environment.location.href,
      version: 4,
    }),
  );
  const capabilities = createReactViewerCapabilities(descriptor, environment);
  const request = currentRequest();
  assert.deepEqual(capabilities.updates.consumeRecovery(request), {
    ...shellRecovery(),
    view: "changes",
  });
  assert.equal(capabilities.updates.consumeRecovery(request), undefined);

  const first = new AbortController();
  capabilities.updates.subscribe(request, actions(), first.signal);
  assert.equal(environment.sources.length, 1);
  first.abort();
  assert.equal(environment.sources[0]?.closed, true);

  const second = new AbortController();
  capabilities.updates.subscribe(request, actions(), second.signal);
  assert.equal(environment.sources.length, 2);
  assert.equal(environment.sources[1]?.closed, false);
  second.abort();
});

test("React live updates close when pagehide fires during registration", () => {
  const environment = new FakeEnvironment();
  environment.pageHideImmediately = true;
  const controller = new AbortController();
  createReactViewerCapabilities(descriptor, environment).updates.subscribe(
    currentRequest(),
    actions(),
    controller.signal,
  );

  assert.equal(environment.sources[0]?.closed, true);
  assert.equal(environment.pageHideStops, 1);
  controller.abort();
  assert.equal(environment.pageHideStops, 1);
});

test("React evidence refresh validates page descriptors before store adoption", async () => {
  const environment = new FakeEnvironment();
  const next = structuredClone(catalogue);
  next.revision.evidence += 1;
  environment.descriptor = {
    ...descriptor,
    source: {
      ...descriptor.source,
      evidenceRevision: next.revision.evidence,
      updateVersion: 5,
    },
    workspace: {
      ...descriptor.workspace!,
      relatedComponents: [{ title: "Field", route: "components/field.html" }],
    },
  };
  environment.responses.push(
    htmlResponse(environment.location.href),
    jsonResponse("http://localhost/__mokly/catalogue.json", next),
  );
  const adopted: { version: number; related: number }[] = [];
  const controller = new AbortController();
  createReactViewerCapabilities(descriptor, environment).updates.subscribe(
    currentRequest(),
    {
      ...actions(),
      adoptEvidence(revision) {
        adopted.push({
          version: revision.source.updateVersion,
          related: revision.workspace?.relatedComponents.length ?? 0,
        });
        return true;
      },
    },
    controller.signal,
  );
  environment.sources[0]!.emit("update", "5");
  await setImmediate();
  assert.deepEqual(adopted, [{ version: 5, related: 1 }]);
  assert.equal(environment.location.reloads, 0);
  controller.abort();
});

test("React evidence refresh rejects mixed public and private revisions", async () => {
  const environment = new FakeEnvironment();
  const descriptorEvidence = catalogue.revision.evidence + 1;
  const publicCatalogue = structuredClone(catalogue);
  publicCatalogue.revision.evidence = descriptorEvidence + 1;
  environment.descriptor = {
    ...descriptor,
    source: {
      ...descriptor.source,
      evidenceRevision: descriptorEvidence,
      updateVersion: 5,
    },
  };
  environment.responses.push(
    htmlResponse(environment.location.href),
    jsonResponse("http://localhost/__mokly/catalogue.json", publicCatalogue),
  );
  let adopted = false;
  createReactViewerCapabilities(descriptor, environment).updates.subscribe(
    currentRequest(),
    {
      ...actions(),
      adoptEvidence() {
        adopted = true;
        return true;
      },
    },
    new AbortController().signal,
  );
  environment.sources[0]!.emit("update", "5");
  await setImmediate();
  await setImmediate();
  assert.equal(adopted, false);
  assert.equal(environment.location.reloads, 1);
});

test("route evidence loading fences revision, location, and cancellation", async () => {
  const environment = new FakeEnvironment();
  const route = catalogue.screens[0]!.route;
  const request = { ...currentRequest(), route };
  environment.location.href = `http://localhost/view/${route}`;
  environment.descriptor = {
    ...descriptor,
    workspace: workspaceEvidence(route),
  };
  environment.responses.push(htmlResponse(environment.location.href));
  const capabilities = createReactViewerCapabilities(descriptor, environment);
  assert.equal(
    (
      await capabilities.evidence.loadRouteEvidence(
        request,
        new AbortController().signal,
      )
    )?.workspace?.entry.route,
    route,
  );

  environment.descriptor = {
    ...environment.descriptor,
    source: { ...descriptor.source, evidenceRevision: 1 },
  };
  environment.responses.push(htmlResponse(environment.location.href));
  assert.equal(
    await capabilities.evidence.loadRouteEvidence(
      request,
      new AbortController().signal,
    ),
    undefined,
  );

  environment.descriptor = {
    ...descriptor,
    workspace: workspaceEvidence(route),
  };
  environment.responses.push(
    htmlResponse(environment.location.href, () => {
      environment.location.href = "http://localhost/";
    }),
  );
  assert.equal(
    await capabilities.evidence.loadRouteEvidence(
      request,
      new AbortController().signal,
    ),
    undefined,
  );

  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(() =>
    capabilities.evidence.loadRouteEvidence(request, aborted.signal),
  );
});

test("route evidence atomically carries a newer public and private revision", async () => {
  const environment = new FakeEnvironment();
  const route = catalogue.screens[0]!.route;
  const next = structuredClone(catalogue);
  next.revision.evidence += 2;
  environment.publicCatalogue = next;
  environment.location.href = `http://localhost/view/${route}`;
  environment.descriptor = {
    ...descriptor,
    source: {
      ...descriptor.source,
      evidenceRevision: next.revision.evidence,
    },
    workspace: workspaceEvidence(route),
  };
  environment.responses.push(htmlResponse(environment.location.href));

  const revision = await createReactViewerCapabilities(
    descriptor,
    environment,
  ).evidence.loadRouteEvidence(
    { ...currentRequest(), route },
    new AbortController().signal,
  );

  assert.ok(revision);
  assert.equal(revision.source.updateVersion, descriptor.source.updateVersion);
  assert.equal(revision.source.evidenceRevision, next.revision.evidence);
  assert.equal(revision.catalogue.revision.evidence, next.revision.evidence);
  assert.equal(revision.workspace?.entry.route, route);

  environment.publicCatalogue = {
    ...next,
    revision: { ...next.revision, evidence: next.revision.evidence + 1 },
  };
  environment.responses.push(htmlResponse(environment.location.href));
  assert.equal(
    await createReactViewerCapabilities(
      descriptor,
      environment,
    ).evidence.loadRouteEvidence(
      { ...currentRequest(), route },
      new AbortController().signal,
    ),
    undefined,
  );
});

test("workspace capabilities reject a stale routed request before transport", () => {
  const environment = new FakeEnvironment();
  let loads = 0;
  const capabilities = createReactViewerCapabilities(descriptor, environment, {
    componentPreviewExpired: async () => false,
    requestComponentPreview: async () => {
      throw new Error("unused");
    },
    workspaceLoader: () => {
      loads += 1;
      return () => undefined;
    },
  });
  assert.throws(() =>
    capabilities.onDemand!.loadWorkspace(
      { ...currentRequest(), route: "screens/elsewhere.html" },
      {
        entry: { route: "components/button.html" },
        previewGeneration: descriptor.source.previewGeneration,
      } as never,
      new AbortController().signal,
      () => undefined,
    ),
  );
  assert.equal(loads, 0);
});

test("initial private workspace evidence is exact-source and route scoped", () => {
  const capabilities = createReactViewerCapabilities(
    descriptor,
    new FakeEnvironment(),
  );
  assert.equal(
    capabilities.evidence.initialWorkspace(currentRequest())?.entry.route,
    currentRequest().route,
  );
  assert.throws(() =>
    capabilities.evidence.initialWorkspace({
      ...currentRequest(),
      source: { ...descriptor.source, updateVersion: 5 },
    }),
  );
  assert.throws(() =>
    capabilities.evidence.initialWorkspace({
      ...currentRequest(),
      route: "screens/elsewhere.html",
    }),
  );
});

function currentRequest(): ViewerCapabilityRequest {
  return {
    route: descriptor.workspace!.entry.route,
    source: descriptor.source,
  };
}

function actions() {
  return {
    adoptEvidence: async () => true,
    captureRecovery: shellRecovery,
  };
}

function shellRecovery() {
  return {
    disclosures: { "folder:pages:fixture": false },
    colorScheme: "dark" as const,
    detailsOpen: true,
    drawerOpen: true,
    filterBaselineDisclosures: { "folder:pages:fixture": false },
    navScroll: 18,
    query: "home",
    regionScrolls: { stage: 42 },
    view: "changes" as const,
    viewport: "mobile" as const,
  };
}

function browseRecovery() {
  const { view: _view, ...recovery } = shellRecovery();
  return { ...recovery, changedOnly: true };
}

class FakeSource {
  closed = false;
  private listeners = new Map<string, (event: { data: string }) => void>();

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
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class FakeEnvironment implements ReactCapabilityEnvironment {
  descriptor = descriptor;
  publicCatalogue = catalogue;
  pageHideImmediately = false;
  pageHideStops = 0;
  readonly sources: FakeSource[] = [];
  readonly responses: Response[] = [];
  readonly storage = new FakeStorage();
  readonly location = {
    href: "http://localhost/view/components/button.html",
    reloads: 0,
    reload() {
      this.reloads += 1;
    },
  };

  createEventSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  fetch = async (): Promise<Response> => this.responses.shift()!;

  onPageHide(callback: () => void): () => void {
    if (this.pageHideImmediately) callback();
    return () => {
      this.pageHideStops += 1;
    };
  }

  parseDocument(): Document {
    return {
      querySelector: (selector: string) => {
        const value = selector.includes("data-mokly-shell-bootstrap")
          ? this.shellBootstrap()
          : this.descriptor;
        return { textContent: JSON.stringify(value) };
      },
    } as unknown as Document;
  }

  private shellBootstrap() {
    const source = this.descriptor.source;
    const route = this.descriptor.workspace?.entry.route;
    return {
      catalogue: this.publicCatalogue,
      context: {
        base: source.base,
        comparisons: true,
        contentVersion: source.contentRevision,
        updateVersion: source.updateVersion,
        ...(source.previewGeneration
          ? { previewGeneration: source.previewGeneration }
          : {}),
      },
      view: route ? { kind: "target", route } : { kind: "home" },
    };
  }
}

function workspaceEvidence(
  route = catalogue.components[0]!.route,
): WorkspaceData {
  const entry = [...catalogue.screens, ...catalogue.components].find(
    (candidate) => candidate.route === route,
  );
  if (!entry) throw new Error("Unknown workspace fixture route.");
  return {
    affected: [],
    base: descriptorBase(),
    changedViews: {},
    comparisonEligible: false,
    comparisons: true,
    components: [],
    entry: { ...entry, variants: [] } as unknown as WorkspaceData["entry"],
    inputChanges: [],
    previewGeneration: "a".repeat(32),
    relatedComponents: [],
    removed: false,
    usedBy: [],
    variants: [],
    viewStates: {},
    views: [],
  };
}

function descriptorBase(): string {
  return "origin/main";
}

function htmlResponse(url: string, beforeText?: () => void): Response {
  return {
    ok: true,
    url,
    text: async () => {
      beforeText?.();
      return "<html></html>";
    },
  } as Response;
}

function jsonResponse(url: string, value: unknown): Response {
  return {
    ok: true,
    url,
    json: async () => value,
  } as Response;
}
