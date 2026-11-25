import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { PropSchema } from "@mokly/model";

import { encodeProps } from "../src/components/codec.js";
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
import { RetryFocus } from "../src/shell/retry_focus.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";
import { WorkspacePropsSection } from "../src/shell/workspace_props.js";

function data(kind: "screen" | "component", pending = false): WorkspaceData {
  return {
    components: [],
    entry: { kind },
    viewUsagePending: pending,
  } as unknown as WorkspaceData;
}

/** The Props section of an entry without an edit form, as markup. */
function section(
  input: WorkspaceData,
  { choose = false, unavailable = false } = {},
): string {
  return renderToStaticMarkup(
    <WorkspacePropsSection
      choose={choose}
      controls={null}
      data={input}
      delivery={{ status: "ready" }}
      focus={new RetryFocus()}
      target={undefined}
      unavailable={unavailable}
    />,
  );
}

test("Props without an edit form say why: no props, a pending or missing usage, or a variant to choose", () => {
  assert.equal(
    section(data("screen")),
    '<p class="mbk-empty-copy mbk-reset">This entry renders without props.</p>',
  );
  assert.equal(
    section(data("screen", true)),
    '<p class="mbk-reset" role="status">Waiting for the component preview.</p>',
  );
  assert.equal(
    section(data("screen"), { unavailable: true }),
    '<p class="mbk-empty-copy mbk-reset">Props are unavailable for this screen.</p>',
  );
  assert.equal(
    section(data("component"), { choose: true }),
    '<p class="mbk-empty-copy mbk-reset">Choose a variant to edit its props.</p>',
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

test("a screen whose props have no controls shows them as its saved props", () => {
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
  const tab = (target: ControlTarget) =>
    renderToStaticMarkup(
      <WorkspacePropsSection
        choose={false}
        controls={<p>Own props</p>}
        data={data("screen")}
        delivery={{ status: "ready" }}
        focus={new RetryFocus()}
        target={target}
        unavailable={false}
      />,
    );
  assert.equal(tab(screen), "<p>Own props</p>");
  assert.equal(
    tab({ ...screen, props: encodeProps({}) }),
    '<p class="mbk-empty-copy mbk-reset">This entry renders without props.</p>',
  );
  const mode = controlsMode(screen, "ready");
  assert.equal(mode, "read-only");
  const panel = renderToStaticMarkup(
    ComponentControlsPanel({
      mode,
      onChange: () => undefined,
      onReset: () => undefined,
      onRetry: () => undefined,
      preview: "saved",
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
    delivery: Parameters<typeof WorkspacePropsSection>[0]["delivery"],
    target: ControlTarget = component,
  ) =>
    renderToStaticMarkup(
      <WorkspacePropsSection
        choose={false}
        controls={<p>Own props</p>}
        data={data(target.kind)}
        delivery={delivery}
        focus={new RetryFocus()}
        target={target}
        unavailable={false}
      />,
    );
  assert.equal(
    tab({ status: "loading" }),
    '<section aria-label="Props status" class="mbk-reset" data-props-section="status"><p class="mbk-reset" role="status" tabindex="-1">Loading props…</p></section>',
  );
  assert.equal(
    tab({ status: "failed", retry: () => (retries += 1) }),
    '<section aria-label="Props status" class="mbk-reset" data-props-section="status"><p class="mbk-reset" role="alert">Props couldn’t be loaded.</p><button class="mbk-text-button mbk-reset" type="button">Try again</button></section>',
  );
  // A replaced catalogue brings new details, so Props keep waiting, as Usage does.
  assert.equal(
    tab({ status: "replaced" }),
    '<section aria-label="Props status" class="mbk-reset" data-props-section="status"><p class="mbk-reset" role="status" tabindex="-1">Loading props…</p></section>',
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
    '<p class="mbk-empty-copy mbk-reset">This entry renders without props.</p>',
  );
  assert.equal(retries, 0);
});
