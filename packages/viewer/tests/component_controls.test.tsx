import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { VIEWER_DIRECTORY, type PropSchema } from "@mokly/model";

import { encodeProps } from "../src/components/codec.js";
import { ComponentRenderError } from "../src/components/render_types.js";
import type { GeneratedComponentView } from "../src/components/views.js";
import { useComponentControls } from "../src/shell/component_controls.js";
import type { ComponentControlsPanel } from "../src/shell/component_controls_panel.js";
import type { ControlTarget } from "../src/shell/control_values.js";
import { ShellDataBoundary } from "../src/shell/data_context.js";
import type { ShellLiveSource } from "../src/shell/data_source.js";
import type {
  ShellDataStore,
  ShellLiveState,
} from "../src/shell/data_store.js";
import { RetryFocus } from "../src/shell/retry_focus.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";

import { flush, liveDescriptor } from "./data_fakes.js";

type PanelProps = Parameters<typeof ComponentControlsPanel>[0];

const target: ControlTarget = {
  path: "components/action/default",
  title: "Default",
  kind: "component",
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: { label: { type: "string" } },
  } as unknown as PropSchema,
  props: encodeProps({ label: "Continue" }),
  controls: { label: { kind: "text" } },
  suppliedSlots: [],
  removed: false,
};

/** The edited row's Desktop view in one scheme, which its frame shows. */
function rowView(colorScheme: "dark" | "light"): GeneratedComponentView {
  return {
    path: `saved/default/${colorScheme}.html`,
    viewport: "desktop",
    colorScheme,
    variantPath: target.path,
  };
}

/** Serve's render route: each view renders, unless `serve.failing` holds. */
function liveSource(serve: { failing: boolean }): ShellLiveSource {
  return {
    loadDescriptor: () => Promise.reject(new Error("not loaded here")),
    subscribe: () => () => undefined,
    render: async (_descriptor, request) => {
      if (serve.failing)
        throw new ComponentRenderError("render-failed", "The render failed.");
      const renderId = `${request.viewport}-${request.colorScheme}`;
      return {
        renderId,
        revision: request.revision,
        previewUrl: `/${VIEWER_DIRECTORY}/components/renders/${renderId}/index.html`,
        props: {},
        usage: { status: "ready", instances: [], slots: [], ranges: [] },
      };
    },
    previewExpired: async () => false,
  };
}

test("a failed render's alert names the props that the edited row's shown frames show", async (t) => {
  GlobalRegistrator.register();
  const serve = { failing: true };
  const live: ShellLiveState = {
    descriptor: liveDescriptor("g"),
    editing: "ready",
    retry: () => undefined,
    source: liveSource(serve),
  };
  // The boundary reads only the index's revision and deployment.
  const store = {
    snapshot: { index: { revision: 1, deploymentId: "d" } },
    routeDelivery: undefined,
    live,
  } as unknown as ShellDataStore;
  const light = rowView("light");
  const dark = rowView("dark");
  const data = { views: [light, dark] } as unknown as WorkspaceData;
  const recovery = new RetryFocus();
  const workspaceRef = { current: null };
  const hook = renderHook(
    ({ contexts }: { contexts: readonly GeneratedComponentView[] }) =>
      useComponentControls({
        comparing: false,
        contexts,
        data,
        recovery,
        target,
        workspaceRef,
      }),
    {
      initialProps: { contexts: [light] },
      wrapper: ({ children }: { children: ReactNode }) => (
        <ShellDataBoundary store={store}>{children}</ShellDataBoundary>
      ),
    },
  );
  t.after(async () => {
    hook.unmount();
    await GlobalRegistrator.unregister();
  });
  const panel = (): PanelProps => {
    const node = hook.result.current.panel;
    assert.ok(isValidElement<PanelProps>(node));
    return node.props;
  };
  /** The body of the failed render's alert, when one shows. */
  const failedBody = () =>
    renderToStaticMarkup(hook.result.current.panel).match(
      /<p class="mbk-reset">(Your edits are kept\.[^<]*)<\/p>/,
    )?.[1];
  const settle = (action: () => void) =>
    act(async () => {
      action();
      await flush();
    });
  const edit = (label: string) =>
    settle(() =>
      panel().onChange("label", { supplied: true, value: label }, true),
    );

  // The first render of the edits fails, so the frame keeps the saved props.
  await edit("Get started");
  assert.equal(
    failedBody(),
    "Your edits are kept. The preview shows the saved props.",
  );
  // Try again renders the edits, then a later edit fails: the frame keeps
  // the earlier edit, the last valid props.
  serve.failing = false;
  await settle(() => panel().onRetry());
  assert.equal(failedBody(), undefined);
  serve.failing = true;
  await edit("Start now");
  assert.equal(
    failedBody(),
    "Your edits are kept. The preview shows the last valid props.",
  );
  // The compact layout picks the Dark frame, which no render covers, and its
  // render of the edits fails.
  await settle(() => hook.rerender({ contexts: [dark] }));
  assert.equal(
    failedBody(),
    "Your edits are kept. The preview shows the saved props.",
  );
});
