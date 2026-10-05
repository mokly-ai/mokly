import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import { viewHref } from "@mokly/viewer/data";
import {
  projectScopedCatalogue,
  type ViewerCapabilityDescriptor,
} from "@mokly/viewer/runtime";

import { createReactViewerCapabilities } from "../dist/client/react_capabilities.js";
import { mergeWorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence_merge.js";

import {
  actions,
  catalogue,
  descriptor,
  FakeEnvironment,
  htmlResponse,
} from "./helpers/react_capability_environment.js";

test("route loads and evidence refreshes retain private Live eligibility", async () => {
  const installed = interactiveDescriptor(true);
  const entry = installed.workspace!.entry;
  const href = viewHref(entry.path);
  const next = structuredClone(catalogue);
  next.revision.evidence += 1;
  const scoped = projectScopedCatalogue(next, {
    kind: "target",
    entryPath: entry.path,
    entryKind: entry.kind,
  });
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
  routeEnvironment.publicCatalogue = scoped;
  routeEnvironment.location.href = `http://localhost${href}`;
  routeEnvironment.responses.push(htmlResponse(routeEnvironment.location.href));

  const routed = await createReactViewerCapabilities(
    installed,
    routeEnvironment,
  ).evidence.loadRouteEvidence(
    { entryPath: entry.path, source: installed.source },
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
  updateEnvironment.publicCatalogue = scoped;
  updateEnvironment.location.href = `http://localhost${href}`;
  updateEnvironment.responses.push(
    htmlResponse(updateEnvironment.location.href),
  );
  const adopted: boolean[] = [];
  const controller = new AbortController();
  createReactViewerCapabilities(installed, updateEnvironment).updates.subscribe(
    { entryPath: entry.path, source: installed.source },
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
