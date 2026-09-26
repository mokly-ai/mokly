import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  readViewerEvidenceRevision,
  ViewerCapabilityScope,
  type ViewerHostCapabilities,
} from "../src/client/host_capabilities.js";
import {
  readViewerCapabilityDescriptor,
  viewerCapabilityDescriptor,
  viewerCapabilityRequest,
} from "../src/client/host_capability_descriptor.js";
import {
  ViewerCapabilityBoundary,
  useViewerCapabilities,
  useViewerInitialWorkspace,
} from "../src/shell/capability_context.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";

import {
  catalogue,
  generation,
  source,
  token,
} from "./host_capabilities_fixture.js";

test("the provider exposes live capabilities and export-style omission", () => {
  const capabilities = {
    evidence: {
      initialWorkspace: () => undefined,
      loadRouteEvidence: async () => undefined,
    },
    source,
    updates: {
      consumeRecovery: () => undefined,
      subscribe: () => undefined,
    },
  } satisfies ViewerHostCapabilities;
  const workspace = {
    entry: { route: "components/action.html" },
  } as unknown as WorkspaceData;
  const Probe = () => (
    <span>
      {useViewerCapabilities()?.source.catalogueId ?? "export"}:
      {useViewerInitialWorkspace()?.entry.route ?? "none"}
    </span>
  );
  assert.equal(
    renderToStaticMarkup(
      <ViewerCapabilityBoundary
        capabilities={capabilities}
        initialWorkspace={workspace}
      >
        <Probe />
      </ViewerCapabilityBoundary>,
    ),
    `<span>${catalogue.identity.id}:components/action.html</span>`,
  );
  assert.equal(renderToStaticMarkup(<Probe />), "<span>export:none</span>");
});

test("a request scope cancels work when its source or route changes", () => {
  const initial = viewerCapabilityRequest(source, "components/button.html");
  const scope = new ViewerCapabilityScope(initial);
  const first = scope.signal;
  assert.equal(scope.replace(initial), first);
  const second = scope.replace(
    viewerCapabilityRequest(source, "components/card.html"),
  );
  assert.equal(first.aborted, true);
  assert.equal(second.aborted, false);
  const replacement = {
    ...source,
    contentRevision: source.contentRevision + 1,
  };
  const third = scope.replace(
    viewerCapabilityRequest(replacement, "components/card.html"),
  );
  assert.equal(second.aborted, true);
  assert.equal(third.aborted, false);
  scope.close();
  assert.equal(third.aborted, true);
});

test("evidence adoption fences source identity and monotonic revisions", () => {
  const request = viewerCapabilityRequest(source, null);
  const next = structuredClone(catalogue);
  next.revision.evidence += 1;
  const nextSource = {
    ...source,
    evidenceRevision: next.revision.evidence,
    updateVersion: 5,
  };
  const revision = readViewerEvidenceRevision(
    source,
    request,
    nextSource,
    next,
  );
  assert.ok(revision);
  assert.equal(revision.source.updateVersion, 5);
  assert.equal(revision.source.evidenceRevision, next.revision.evidence);
  assert.ok(
    readViewerEvidenceRevision(
      source,
      request,
      { ...nextSource, updateVersion: 4 },
      next,
    ),
  );
  assert.equal(
    readViewerEvidenceRevision(source, request, source, catalogue),
    undefined,
  );

  const wrongContent = structuredClone(next);
  wrongContent.revision.content += 1;
  assert.equal(
    readViewerEvidenceRevision(source, request, nextSource, wrongContent),
    undefined,
  );
  assert.equal(
    readViewerEvidenceRevision(
      source,
      viewerCapabilityRequest({ ...source, base: "release" }, request.route),
      nextSource,
      next,
    ),
    undefined,
  );
});

test("temporary rendering is independent from on-demand document availability", () => {
  const context = {
    base: source.base,
    contentVersion: source.contentRevision,
    renderCapability: { generation, token },
    updateVersion: source.updateVersion,
  };
  const descriptor = viewerCapabilityDescriptor(catalogue, context);
  assert.ok(descriptor);
  assert.equal("previewGeneration" in descriptor.source, false);
  assert.equal(descriptor.source.renderGeneration, generation);
  assert.deepEqual(readViewerCapabilityDescriptor(descriptor), descriptor);
  assert.throws(
    () =>
      readViewerCapabilityDescriptor({
        ...descriptor,
        source: { ...descriptor.source, renderGeneration: "c".repeat(32) },
      }),
    /Invalid live viewer render capability/,
  );
  assert.throws(
    () =>
      viewerCapabilityDescriptor(catalogue, {
        ...context,
        previewGeneration: "c".repeat(32),
      }),
    /Live viewer render generations are inconsistent/,
  );
});
