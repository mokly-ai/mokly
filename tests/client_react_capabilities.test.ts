import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { readCatalogue } from "@mokly/viewer";
import { viewHref } from "@mokly/viewer/data";
import type {
  ViewerCapabilityDescriptor,
  ViewerCapabilityRequest,
} from "@mokly/viewer/runtime";
import type { WorkspaceData } from "@mokly/viewer/server";

import {
  createReactViewerCapabilities,
  type ReactCapabilityEnvironment,
} from "../dist/client/react_capabilities.js";
import { mergeWorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence_merge.js";

const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync("docs/protocol/fixtures/catalogue-v3.json", "utf8"),
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

test("watched reload recovery carries the Live preview mode once", () => {
  const environment = new FakeEnvironment();
  environment.storage.setItem(
    "mokly:live-update-recovery",
    JSON.stringify({
      browse: { ...browseRecovery(), previewMode: "live" },
      url: environment.location.href,
      version: 4,
    }),
  );
  const capabilities = createReactViewerCapabilities(descriptor, environment);
  const request = currentRequest();
  assert.deepEqual(capabilities.updates.consumeRecovery(request), {
    ...shellRecovery(),
    previewMode: "live",
    view: "changes",
  });
  assert.equal(capabilities.updates.consumeRecovery(request), undefined);

  environment.storage.setItem(
    "mokly:live-update-recovery",
    JSON.stringify({
      browse: { ...browseRecovery(), previewMode: "interactive" },
      url: environment.location.href,
      version: 4,
    }),
  );
  assert.equal(capabilities.updates.consumeRecovery(request), undefined);
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

test("React live updates validate rebuild events before store adoption", () => {
  const environment = new FakeEnvironment();
  const reported: unknown[] = [];
  environment.reportError = (error) => reported.push(error);
  const adopted: number[] = [];
  createReactViewerCapabilities(descriptor, environment).updates.subscribe(
    currentRequest(),
    {
      ...actions(),
      adoptRebuildStatus(status) {
        adopted.push(status.sequence);
      },
    },
    new AbortController().signal,
  );
  environment.sources[0]!.emit(
    "rebuild",
    JSON.stringify({
      failure: null,
      sequence: 2,
      updateVersion: 5,
      updating: true,
    }),
  );
  environment.sources[0]!.emit(
    "rebuild",
    JSON.stringify({
      extra: true,
      failure: null,
      sequence: 3,
      updateVersion: 5,
      updating: false,
    }),
  );
  assert.deepEqual(adopted, [2]);
  assert.equal(reported.length, 1);
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
      relatedComponents: [{ id: "field", title: "Field" }],
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
  const entry = catalogue.screens[0]!;
  const entryId = entry.id;
  const request = { ...currentRequest(), entryId };
  environment.location.href = `http://localhost${viewHref(entry.kind, entryId)}`;
  environment.descriptor = {
    ...descriptor,
    workspace: workspaceEvidence(entryId),
  };
  environment.responses.push(htmlResponse(environment.location.href));
  const capabilities = createReactViewerCapabilities(descriptor, environment);
  assert.equal(
    (
      await capabilities.evidence.loadRouteEvidence(
        request,
        new AbortController().signal,
      )
    )?.workspace?.entry.id,
    entryId,
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
    workspace: workspaceEvidence(entryId),
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
  const entry = catalogue.screens[0]!;
  const entryId = entry.id;
  const next = structuredClone(catalogue);
  next.revision.evidence += 2;
  environment.publicCatalogue = next;
  environment.location.href = `http://localhost${viewHref(entry.kind, entryId)}`;
  environment.descriptor = {
    ...descriptor,
    source: {
      ...descriptor.source,
      evidenceRevision: next.revision.evidence,
    },
    workspace: workspaceEvidence(entryId),
  };
  environment.responses.push(htmlResponse(environment.location.href));

  const revision = await createReactViewerCapabilities(
    descriptor,
    environment,
  ).evidence.loadRouteEvidence(
    { ...currentRequest(), entryId },
    new AbortController().signal,
  );

  assert.ok(revision);
  assert.equal(revision.source.updateVersion, descriptor.source.updateVersion);
  assert.equal(revision.source.evidenceRevision, next.revision.evidence);
  assert.equal(revision.catalogue.revision.evidence, next.revision.evidence);
  assert.equal(revision.workspace?.entry.id, entryId);

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
      { ...currentRequest(), entryId },
      new AbortController().signal,
    ),
    undefined,
  );
});

test("route loads and evidence refreshes retain private Live eligibility", async () => {
  const installed = interactiveDescriptor(true);
  const entry = installed.workspace!.entry;
  const href = viewHref(entry.kind, entry.id);
  const next = structuredClone(catalogue);
  next.revision.evidence += 1;
  const nextDescriptor: ViewerCapabilityDescriptor = {
    ...installed,
    source: {
      ...installed.source,
      evidenceRevision: next.revision.evidence,
      updateVersion: installed.source.updateVersion + 1,
    },
    workspace: { ...installed.workspace!, interactive: true },
  };
  const routeEnvironment = new FakeEnvironment();
  routeEnvironment.descriptor = nextDescriptor;
  routeEnvironment.publicCatalogue = next;
  routeEnvironment.location.href = `http://localhost${href}`;
  routeEnvironment.responses.push(htmlResponse(routeEnvironment.location.href));

  const routed = await createReactViewerCapabilities(
    installed,
    routeEnvironment,
  ).evidence.loadRouteEvidence(
    { entryId: entry.id, source: installed.source },
    new AbortController().signal,
  );
  assert.equal(routed?.workspace?.interactive, true);
  assert.ok(routed?.workspace);
  const merged = { ...routed.workspace };
  delete merged.interactive;
  mergeWorkspaceEvidence(merged, routed.workspace);
  assert.equal(merged.interactive, true);

  const updateEnvironment = new FakeEnvironment();
  updateEnvironment.descriptor = nextDescriptor;
  updateEnvironment.publicCatalogue = next;
  updateEnvironment.location.href = `http://localhost${href}`;
  updateEnvironment.responses.push(
    htmlResponse(updateEnvironment.location.href),
    jsonResponse("http://localhost/__mokly/catalogue.json", next),
  );
  const adopted: boolean[] = [];
  const controller = new AbortController();
  createReactViewerCapabilities(installed, updateEnvironment).updates.subscribe(
    { entryId: entry.id, source: installed.source },
    {
      ...actions(),
      adoptEvidence(revision) {
        if (revision.workspace?.interactive !== undefined)
          adopted.push(revision.workspace.interactive);
        return true;
      },
    },
    controller.signal,
  );
  updateEnvironment.sources[0]!.emit(
    "update",
    String(nextDescriptor.source.updateVersion),
  );
  await setImmediate();
  assert.deepEqual(adopted, [true]);
  controller.abort();
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
      { ...currentRequest(), entryId: "elsewhere" },
      {
        entry: { id: "button" },
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
    capabilities.evidence.initialWorkspace(currentRequest())?.entry.id,
    currentRequest().entryId,
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
      entryId: "elsewhere",
    }),
  );
});

function currentRequest(): ViewerCapabilityRequest {
  return {
    entryId: descriptor.workspace!.entry.id,
    source: descriptor.source,
  };
}

function interactiveDescriptor(
  interactive: boolean,
): ViewerCapabilityDescriptor {
  return {
    ...descriptor,
    interactive: {
      generation: "a".repeat(32),
      port: 4174,
      state: "ready",
    },
    workspace: { ...descriptor.workspace!, interactive },
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
    type: "interactive" | "ready" | "rebuild" | "update",
    callback: (event: { data: string }) => void,
  ): void {
    this.listeners.set(type, callback);
  }

  close(): void {
    this.closed = true;
  }

  emit(
    type: "interactive" | "ready" | "rebuild" | "update",
    data: string,
  ): void {
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
  reportError?: (error: unknown) => void;

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
    const entry = this.descriptor.workspace?.entry;
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
      view: entry
        ? { kind: "target", entryId: entry.id, entryKind: entry.kind }
        : { kind: "home" },
    };
  }
}

function workspaceEvidence(id = catalogue.components[0]!.id): WorkspaceData {
  const entry = [...catalogue.screens, ...catalogue.components].find(
    (candidate) => candidate.id === id,
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
