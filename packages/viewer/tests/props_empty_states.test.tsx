import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ComponentViewRecord } from "../src/components/manifest_types.js";
import {
  ShellDataBoundary,
  useLiveEditingStart,
  useViewerCapabilities,
  type LiveEditingStart,
} from "../src/shell/data_context.js";
import type { LiveEditingStatus } from "../src/shell/data_descriptor.js";
import type { ShellDataStore } from "../src/shell/data_store.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";
import { WorkspaceProps } from "../src/shell/workspace_props.js";

function data(kind: "screen" | "component", pending = false): WorkspaceData {
  return {
    components: [],
    entry: { kind },
    viewUsagePending: pending,
  } as unknown as WorkspaceData;
}

function usage(instances: number): ComponentViewRecord {
  return {
    instances: Array.from({ length: instances }, (_, index) => ({
      key: `${index}`,
    })),
    slots: [],
  } as unknown as ComponentViewRecord;
}

test("a screen's Props tab without own props names why nothing is selected", () => {
  const props = (input: WorkspaceData, view?: ComponentViewRecord) =>
    renderToStaticMarkup(
      <WorkspaceProps data={input} selection={view ? { usage: view } : {}} />,
    );
  assert.equal(
    props(data("screen"), usage(0)),
    '<p class="mbk-empty-copy">This entry renders without props.</p>',
  );
  assert.equal(
    props(data("screen")),
    '<p class="mbk-empty-copy">Props are unavailable for this screen.</p>',
  );
  assert.equal(
    props(data("screen"), usage(2)),
    '<p class="mbk-empty-copy">Select a component instance to see its supplied props.</p>',
  );
  assert.equal(
    props(data("screen", true)),
    '<p role="status">Waiting for the component preview.</p>',
  );
  assert.equal(
    props(data("component")),
    '<p class="mbk-empty-copy">Select a component instance to see its supplied props.</p>',
  );
});

function start(editing: LiveEditingStatus | undefined, retry = () => {}) {
  let shown: LiveEditingStart | undefined;
  let ready = false;
  function Probe() {
    shown = useLiveEditingStart();
    ready = useViewerCapabilities() !== undefined;
    return null;
  }
  const store = {
    snapshot: { index: { revision: 1, deploymentId: "d" } },
    routeDelivery: undefined,
    live: { descriptor: undefined, editing, retry, source: undefined },
  } as unknown as ShellDataStore;
  renderToStaticMarkup(
    <ShellDataBoundary store={store}>
      <Probe />
    </ShellDataBoundary>,
  );
  return { ready, shown };
}

test("live editing prepares, or offers its retry, until the capability installs", () => {
  const retry = () => {};
  assert.deepEqual(start("preparing"), {
    ready: false,
    shown: { status: "preparing" },
  });
  const failed = start("failed", retry).shown;
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.status === "failed" ? failed.retry : undefined, retry);
  assert.deepEqual(start(undefined), { ready: false, shown: undefined });
});
