import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { encodeProps } from "../src/components/codec.js";
import type { ComponentViewRecord } from "../src/components/manifest_types.js";
import type { PropSchema } from "../src/components/prop_types.js";
import { ComponentControlsPanel } from "../src/shell/component_controls_panel.js";
import {
  controlsMode,
  initialComponentEditorState,
} from "../src/shell/component_controls_state.js";
import type { ControlTarget } from "../src/shell/control_values.js";
import {
  ShellDataBoundary,
  useLiveEditingStart,
  useViewerCapabilities,
  type LiveEditingStart,
} from "../src/shell/data_context.js";
import type { LiveEditingStatus } from "../src/shell/data_descriptor.js";
import type { ShellDataStore } from "../src/shell/data_store.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";
import {
  WorkspaceProps,
  WorkspacePropsTab,
} from "../src/shell/workspace_props.js";

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
    '<p class="mbk-empty-copy mbk-reset">This entry renders without props.</p>',
  );
  assert.equal(
    props(data("screen")),
    '<p class="mbk-empty-copy mbk-reset">Props are unavailable for this screen.</p>',
  );
  assert.equal(
    props(data("screen"), usage(2)),
    '<p class="mbk-empty-copy mbk-reset">Select a component instance to see its supplied props.</p>',
  );
  assert.equal(
    props(data("screen", true)),
    '<p class="mbk-reset" role="status">Waiting for the component preview.</p>',
  );
  assert.equal(
    props(data("component")),
    '<p class="mbk-empty-copy mbk-reset">Select a component instance to see its supplied props.</p>',
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

test("a screen whose props have no controls shows them, with or without instances", () => {
  const screen: ControlTarget = {
    path: "home",
    title: "Home",
    kind: "screen",
    propSchema: {
      type: "object",
      additionalProperties: false,
      properties: { badge: { type: "object" } },
    } as unknown as PropSchema,
    props: encodeProps({ badge: { text: "Ready" } }),
    controls: {},
    suppliedSlots: [],
    removed: false,
  };
  const tab = (target: ControlTarget, view: ComponentViewRecord | undefined) =>
    renderToStaticMarkup(
      <WorkspacePropsTab
        controls={<p>Own props</p>}
        data={data("screen")}
        delivery={{ status: "ready" }}
        instance={undefined}
        target={target}
        usage={view}
      />,
    );
  for (const view of [usage(0), usage(2), undefined])
    assert.equal(tab(screen, view), "<p>Own props</p>");
  assert.equal(
    tab({ ...screen, props: encodeProps({}) }, usage(2)),
    '<p class="mbk-empty-copy mbk-reset">Select a component instance to see its supplied props.</p>',
  );
  assert.equal(
    tab({ ...screen, props: encodeProps({}) }, usage(0)),
    '<p class="mbk-empty-copy mbk-reset">This entry renders without props.</p>',
  );
  const mode = controlsMode(screen, false, "ready");
  assert.equal(mode, "read-only");
  const panel = renderToStaticMarkup(
    ComponentControlsPanel({
      data: data("screen"),
      mode,
      onChange: () => undefined,
      onCurrent: () => undefined,
      onReset: () => undefined,
      onRetry: () => undefined,
      state: initialComponentEditorState(screen, "s", {}),
      target: screen,
    }),
  );
  assert.match(
    panel,
    /<h3 class="mbk-reset" tabindex="-1">Saved props<\/h3><p class="mbk-reset">Home<\/p><\/div><\/div><p class="mbk-controls-notice mbk-reset">These props are read-only\.<\/p><dl aria-label="Supplied props" class="mbk-props mbk-reset"><div class="mbk-reset"><dt class="mbk-reset">badge<\/dt><dd class="mbk-reset"><code class="mbk-reset">\{&quot;text&quot;: &quot;Ready&quot;\}<\/code><\/dd><\/div><\/dl>/,
  );
});

test("own props wait for the routed detail, which alone carries their order", () => {
  const component = {
    path: "action",
    title: "Action",
    kind: "component",
    propSchema: { type: "object", properties: {} } as unknown as PropSchema,
    props: encodeProps({ label: "Continue" }),
    controls: {},
    suppliedSlots: [],
    removed: false,
  } satisfies ControlTarget;
  let retries = 0;
  const tab = (
    delivery: Parameters<typeof WorkspacePropsTab>[0]["delivery"],
    target: ControlTarget = component,
  ) =>
    renderToStaticMarkup(
      <WorkspacePropsTab
        controls={<p>Own props</p>}
        data={data(target.kind)}
        delivery={delivery}
        instance={undefined}
        target={target}
        usage={undefined}
      />,
    );
  assert.equal(
    tab({ status: "loading" }),
    '<section aria-label="Props status" class="mbk-reset" data-props-section="status"><p class="mbk-reset" role="status">Loading props…</p></section>',
  );
  assert.equal(
    tab({ status: "failed", retry: () => (retries += 1) }),
    '<section aria-label="Props status" class="mbk-reset" data-props-section="status"><p class="mbk-reset" role="alert">Props couldn’t be loaded.</p><button class="mbk-text-button mbk-reset" type="button">Try again</button></section>',
  );
  // A replaced catalogue brings new details, so Props keep waiting, as Usage does.
  assert.equal(
    tab({ status: "replaced" }),
    '<section aria-label="Props status" class="mbk-reset" data-props-section="status"><p class="mbk-reset" role="status">Loading props…</p></section>',
  );
  assert.equal(tab({ status: "ready" }), "<p>Own props</p>");
  // A screen without own props never waits: the detail orders no fields.
  const bare: ControlTarget = {
    ...component,
    kind: "screen",
    props: encodeProps({}),
  };
  assert.equal(
    tab({ status: "loading" }, bare),
    '<p class="mbk-empty-copy mbk-reset">Props are unavailable for this screen.</p>',
  );
  assert.equal(retries, 0);
});
