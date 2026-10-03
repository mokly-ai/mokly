import assert from "node:assert/strict";
import test from "node:test";

import { viewHref } from "@mokly/viewer/data";
import { projectScopedCatalogue } from "@mokly/viewer/runtime";

import { createReactViewerCapabilities } from "../dist/client/react_capabilities.js";

import {
  catalogue,
  currentRequest,
  descriptor,
  FakeEnvironment,
  htmlResponse,
  workspaceEvidence,
} from "./helpers/react_capability_environment.js";

test("route evidence loading fences revision, location, and cancellation", async () => {
  const environment = new FakeEnvironment();
  const entry = catalogue.screens[0]!;
  const request = { ...currentRequest(), entryId: entry.id };
  environment.location.href = `http://localhost${viewHref(entry.kind, entry.id)}`;
  environment.descriptor = {
    ...descriptor,
    workspace: workspaceEvidence(entry.id),
  };
  environment.publicCatalogue = projectScopedCatalogue(catalogue, {
    kind: "target",
    entryId: entry.id,
    entryKind: entry.kind,
  });
  environment.responses.push(htmlResponse(environment.location.href));
  const capabilities = createReactViewerCapabilities(descriptor, environment);
  assert.equal(
    (
      await capabilities.evidence.loadRouteEvidence(
        request,
        new AbortController().signal,
      )
    )?.workspace?.entry.id,
    entry.id,
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
    workspace: workspaceEvidence(entry.id),
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

  environment.location.href = `http://localhost${viewHref(entry.kind, entry.id)}`;
  environment.responses.push(
    htmlResponse(environment.location.href, undefined, false),
  );
  assert.equal(
    await capabilities.evidence.loadRouteEvidence(
      request,
      new AbortController().signal,
    ),
    undefined,
  );

  environment.publicCatalogue = projectScopedCatalogue(catalogue, {
    kind: "home",
  });
  environment.responses.push(htmlResponse(environment.location.href));
  await assert.rejects(() =>
    capabilities.evidence.loadRouteEvidence(
      request,
      new AbortController().signal,
    ),
  );
});

test("route evidence atomically carries a newer public and private revision", async () => {
  const environment = new FakeEnvironment();
  const entry = catalogue.screens[0]!;
  const next = structuredClone(catalogue);
  next.revision.evidence += 2;
  environment.publicCatalogue = projectScopedCatalogue(next, {
    kind: "target",
    entryId: entry.id,
    entryKind: entry.kind,
  });
  environment.location.href = `http://localhost${viewHref(entry.kind, entry.id)}`;
  environment.descriptor = {
    ...descriptor,
    source: {
      ...descriptor.source,
      evidenceRevision: next.revision.evidence,
    },
    workspace: workspaceEvidence(entry.id),
  };
  environment.responses.push(htmlResponse(environment.location.href));

  const revision = await createReactViewerCapabilities(
    descriptor,
    environment,
  ).evidence.loadRouteEvidence(
    { ...currentRequest(), entryId: entry.id },
    new AbortController().signal,
  );

  assert.ok(revision);
  assert.equal(revision.source.updateVersion, descriptor.source.updateVersion);
  assert.equal(revision.source.evidenceRevision, next.revision.evidence);
  assert.equal(revision.catalogue.revision.evidence, next.revision.evidence);
  assert.equal(revision.workspace?.entry.id, entry.id);

  environment.publicCatalogue = projectScopedCatalogue(
    {
      ...next,
      revision: { ...next.revision, evidence: next.revision.evidence + 1 },
    },
    { kind: "target", entryId: entry.id, entryKind: entry.kind },
  );
  environment.responses.push(htmlResponse(environment.location.href));
  assert.equal(
    await createReactViewerCapabilities(
      descriptor,
      environment,
    ).evidence.loadRouteEvidence(
      { ...currentRequest(), entryId: entry.id },
      new AbortController().signal,
    ),
    undefined,
  );
});

test("use-case and page route evidence require no private workspace", async () => {
  for (const entry of [catalogue.useCases[0]!, catalogue.pages[0]!]) {
    const environment = new FakeEnvironment();
    environment.location.href = `http://localhost${viewHref(entry.kind, entry.id)}`;
    const { workspace: _workspace, ...withoutWorkspace } = descriptor;
    environment.descriptor = withoutWorkspace;
    environment.publicCatalogue = projectScopedCatalogue(catalogue, {
      kind: "target",
      entryId: entry.id,
      entryKind: entry.kind,
    });
    environment.responses.push(htmlResponse(environment.location.href));
    const revision = await createReactViewerCapabilities(
      descriptor,
      environment,
    ).evidence.loadRouteEvidence(
      { ...currentRequest(), entryId: entry.id },
      new AbortController().signal,
    );
    assert.ok(revision, entry.id);
    assert.equal(revision.workspace, undefined, entry.id);
    assert.notEqual(revision.catalogue, environment.publicCatalogue);
  }
});

test("workspace capabilities reject stale requests and bind initial evidence", () => {
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
        entry: { id: "action" },
        previewGeneration: descriptor.source.previewGeneration,
      } as never,
      new AbortController().signal,
      () => undefined,
    ),
  );
  assert.equal(loads, 0);
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
