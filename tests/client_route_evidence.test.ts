import assert from "node:assert/strict";
import test from "node:test";

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
  const route = catalogue.screens[0]!.route;
  const request = { ...currentRequest(), route };
  environment.location.href = `http://localhost/view/${route}`;
  environment.descriptor = {
    ...descriptor,
    workspace: workspaceEvidence(route),
  };
  environment.publicCatalogue = projectScopedCatalogue(catalogue, {
    kind: "target",
    route,
  });
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

  environment.location.href = `http://localhost/view/${route}`;
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
  const route = catalogue.screens[0]!.route;
  const next = structuredClone(catalogue);
  next.revision.evidence += 2;
  environment.publicCatalogue = projectScopedCatalogue(next, {
    kind: "target",
    route,
  });
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

  environment.publicCatalogue = projectScopedCatalogue(
    {
      ...next,
      revision: { ...next.revision, evidence: next.revision.evidence + 1 },
    },
    { kind: "target", route },
  );
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

test("use-case and page route evidence require no private workspace", async () => {
  for (const route of [
    catalogue.useCases[0]!.route,
    catalogue.pages[0]!.route,
  ]) {
    const environment = new FakeEnvironment();
    environment.location.href = `http://localhost/view/${route}`;
    const { workspace: _workspace, ...withoutWorkspace } = descriptor;
    environment.descriptor = withoutWorkspace;
    environment.publicCatalogue = projectScopedCatalogue(catalogue, {
      kind: "target",
      route,
    });
    environment.responses.push(htmlResponse(environment.location.href));
    const revision = await createReactViewerCapabilities(
      descriptor,
      environment,
    ).evidence.loadRouteEvidence(
      { ...currentRequest(), route },
      new AbortController().signal,
    );
    assert.ok(revision, route);
    assert.equal(revision.workspace, undefined, route);
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
