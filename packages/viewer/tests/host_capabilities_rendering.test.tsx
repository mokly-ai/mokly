import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";
import { test } from "node:test";

import { viewerCapabilityDescriptor } from "../src/client/host_capability_descriptor.js";
import { readViewerWorkspace } from "../src/client/workspace_descriptor.js";
import { renderHydratedShellPage } from "../src/shell/document.js";
import { workspaceData } from "../src/shell/workspace_data.js";
import {
  readShellBootstrapState,
  resolveShellBootstrap,
  serializeShellBootstrap,
  shellBootstrap,
} from "../src/standalone/bootstrap.js";
import { readScopedShellBootstrap } from "../src/standalone/scoped_bootstrap.js";
import { viewerCatalogue, viewerView } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import {
  catalogue,
  generation,
  source,
  token,
} from "./host_capabilities_fixture.js";

test("live SSR carries a private descriptor while export carries no host loader", () => {
  const display = viewerCatalogue(catalogue);
  const { publicModel: _publicModel, ...privateDisplay } = display;
  const view = viewerView(display, {
    ...defaultSelection,
    screenId: catalogue.components[0]!.id,
  });
  const liveContext = {
    base: source.base,
    contentVersion: source.contentRevision,
    previewGeneration: generation,
    readModel: catalogue,
    renderCapability: { generation, token },
    updateVersion: source.updateVersion,
  };
  assert.deepEqual(
    viewerCapabilityDescriptor(catalogue, liveContext)?.source,
    source,
  );
  const live = renderHydratedShellPage(view, liveContext, privateDisplay);
  assert.match(live, /data-mokly-host-capabilities=""/);
  assert.match(live, /client\/react-host\.js/);
  assert.match(live, new RegExp(token));
  const bootstrapState = live.match(
    /data-mokly-shell-bootstrap="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  assert.ok(bootstrapState);
  const bootstrap = readScopedShellBootstrap(JSON.parse(bootstrapState));
  assert.ok(
    bootstrap.catalogue.screens.some((screen) =>
      screen.views.some((screenView) => screenView.usage.status === "omitted"),
    ),
  );
  const state = live.match(
    /data-mokly-host-capability-state="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  assert.ok(state);
  const descriptor = JSON.parse(state);
  assert.equal(view.kind, "target");
  if (view.kind !== "target")
    throw new Error("Expected a target fixture view.");
  assert.equal(descriptor.workspace.entry.route, view.target.entry.route);
  assert.equal(descriptor.workspace.base, source.base);
  assert.equal("renderCapability" in descriptor.workspace, false);
  for (const leaked of [{ token }, { renderCapability: { generation, token } }])
    assert.throws(
      () => readViewerWorkspace({ ...descriptor.workspace, ...leaked }, source),
      /Invalid viewer workspace evidence/,
    );

  const deploymentId = "c".repeat(64);
  const exported = renderHydratedShellPage(view, {
    base: source.base,
    delivery: {
      schemaVersion: 2,
      deploymentId,
      canonicalPath: "/",
      comparisonUrl: null,
      idRoutes: {},
    },
    readModel: { ...catalogue, deploymentId },
    updateVersion: 0,
  });
  assert.doesNotMatch(exported, /data-mokly-host-capabilities/);
  assert.doesNotMatch(exported, /client\/react-host\.js/);
  assert.doesNotMatch(exported, new RegExp(token));
  assert.match(exported, /client\/react-shell\.js/);
});

test("server rendering serializes each embedded state exactly once", async () => {
  const display = viewerCatalogue(catalogue);
  const { publicModel: _publicModel, ...privateDisplay } = display;
  const view = viewerView(display, {
    ...defaultSelection,
    screenId: catalogue.components[0]!.id,
  });
  const session = new Session();
  session.connect();
  try {
    await session.post("Profiler.enable");
    await session.post("Profiler.startPreciseCoverage", {
      callCount: true,
      detailed: true,
    });
    renderHydratedShellPage(
      view,
      {
        base: source.base,
        contentVersion: source.contentRevision,
        previewGeneration: generation,
        readModel: catalogue,
        renderCapability: { generation, token },
        updateVersion: source.updateVersion,
      },
      privateDisplay,
    );
    const { result } = await session.post("Profiler.takePreciseCoverage");
    const calls = (name: string) =>
      result
        .flatMap((script) => script.functions)
        .filter((fn) => fn.functionName === name)
        .reduce((total, fn) => total + (fn.ranges[0]?.count ?? 0), 0);
    assert.equal(calls("serializeShellBootstrap"), 1);
    assert.equal(calls("serializeViewerCapabilityDescriptor"), 1);
  } finally {
    await session.post("Profiler.stopPreciseCoverage");
    session.disconnect();
  }
});

test("static shell, workspace and deployment derive from the complete model", () => {
  const display = viewerCatalogue(catalogue);
  const { publicModel: _publicModel, ...privateDisplay } = display;
  const view = viewerView(display, {
    ...defaultSelection,
    screenId: catalogue.components[0]!.id,
  });
  const deploymentId = "d".repeat(64);
  const publicModel = { ...catalogue, deploymentId };
  const delivery = {
    schemaVersion: 2 as const,
    deploymentId,
    canonicalPath: "/view/components/action.html",
    comparisonUrl: null,
    idRoutes: {},
  };
  const context = {
    base: source.base,
    delivery,
    readModel: publicModel,
    updateVersion: 0,
  };
  const html = renderHydratedShellPage(view, context, privateDisplay);
  const bootstrapJson = html.match(
    /data-mokly-shell-bootstrap="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  const workspaceJson = html.match(
    /data-workspace-data="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  assert.ok(bootstrapJson);
  assert.ok(workspaceJson);
  const resolved = resolveShellBootstrap(
    readShellBootstrapState(JSON.parse(bootstrapJson)),
    publicModel,
  );
  assert.equal(
    serializeShellBootstrap(resolved),
    serializeShellBootstrap(shellBootstrap(publicModel, view, context)),
  );
  assert.equal(resolved.catalogue.deploymentId, deploymentId);
  assert.equal(resolved.context.delivery?.deploymentId, deploymentId);
  assert.equal(view.kind, "target");
  if (
    view.kind !== "target" ||
    view.target.kind !== "entry" ||
    view.target.entry.kind !== "component"
  )
    throw new Error("Expected a current component route.");
  assert.deepEqual(
    JSON.parse(workspaceJson),
    workspaceData(privateDisplay, context, view.target.entry),
  );
});
