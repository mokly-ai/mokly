import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { VIEWER_DIRECTORY } from "@mokly/model";

import { encodeProps } from "../src/components/codec.js";
import { ComponentRenderError } from "../src/components/render_types.js";
import type { GeneratedComponentView } from "../src/components/views.js";
import { useComponentControls } from "../src/shell/component_controls.js";
import type { ComponentControlsPanel } from "../src/shell/component_controls_panel.js";
import { controlTarget } from "../src/shell/control_values.js";
import { RetryFocus } from "../src/shell/retry_focus.js";
import { routeFromUrl, routeHref } from "../src/shell/routes.js";
import { ShellStoreProvider } from "../src/shell/store.js";
import { workspaceData } from "../src/shell/workspace_data.js";

import {
  catalogueFixture,
  detailPairs,
  indexFixture,
} from "./catalogue_v9_fixture.js";
import { FakeDataSource, flush, liveDescriptor } from "./data_fakes.js";

type PanelProps = Parameters<typeof ComponentControlsPanel>[0];

/** The edited row's Desktop view in one scheme, which its frame shows. */
function rowView(
  path: string,
  colorScheme: "dark" | "light",
): GeneratedComponentView {
  return {
    path: `saved/default/${colorScheme}.html`,
    viewport: "desktop",
    colorScheme,
    variantPath: path,
  };
}

test("a failed render's alert names the props that the edited row's shown frames show", async (t) => {
  const descriptor = liveDescriptor("2".repeat(64));
  const index = indexFixture((raw) => {
    raw.live = { generation: descriptor.generation };
  });
  const source = new FakeDataSource(true);
  const live = source.live;
  assert.ok(live);
  const catalogue = catalogueFixture(index);
  const entry = catalogue.publicModel.components.find(
    ({ path }) => path === "components/action/default",
  );
  assert.ok(entry);
  const target = controlTarget(entry, { value: entry, removed: false }, false);
  assert.ok(target);
  const light = rowView(target.path, "light");
  const dark = rowView(target.path, "dark");
  const data = {
    ...workspaceData(catalogue, { base: index.base ?? "" }, entry),
    views: [light, dark],
  };
  const details = detailPairs(["components/action", target.path]);
  const url = new URL(routeHref(target.path), "http://localhost");
  const recovery = new RetryFocus();
  const workspaceRef = { current: null };
  GlobalRegistrator.register({ url: url.href });
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
        <ShellStoreProvider
          context={{}}
          index={index}
          initialDetails={details}
          interactive
          route={(catalogue) => routeFromUrl(catalogue, url)}
          source={source}
        >
          {children}
        </ShellStoreProvider>
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
  const attempt = async (
    action: () => void,
    colorScheme: "light" | "dark",
    acceptedLabel?: string,
  ) => {
    await settle(action);
    const pending = live.renders.shift();
    assert.ok(pending, "the installed live capability must request a render");
    const { request } = pending.input;
    assert.deepEqual(pending.input.descriptor, descriptor);
    assert.equal(request.revision, index.revision);
    assert.equal(request.colorScheme, colorScheme);
    await settle(() => {
      if (acceptedLabel === undefined) {
        pending.reject(
          new ComponentRenderError("render-failed", "The render failed."),
        );
        return;
      }
      pending.resolve({
        renderId: "accepted",
        revision: index.revision,
        previewUrl: `/${VIEWER_DIRECTORY}/components/renders/accepted/index.html`,
        props: encodeProps({ label: acceptedLabel }),
        usage: { status: "ready", instances: [], slots: [], ranges: [] },
      });
    });
  };
  const edit = (label: string) => () =>
    panel().onChange("label", { supplied: true, value: label }, true);
  await settle(() => live.descriptor().resolve(descriptor));

  // The first render of the edits fails, so the frame keeps the saved props.
  await attempt(edit("Get started"), "light");
  assert.equal(
    failedBody(),
    "Your edits are kept. The preview shows the saved props.",
  );
  // Try again renders the edits, then a later edit fails: the frame keeps
  // the earlier edit, the last valid props.
  await attempt(() => panel().onRetry(), "light", "Get started");
  assert.equal(failedBody(), undefined);
  await attempt(edit("Start now"), "light");
  assert.equal(
    failedBody(),
    "Your edits are kept. The preview shows the last valid props.",
  );
  // The compact layout picks the Dark frame, which no render covers, and its
  // render of the edits fails.
  await attempt(() => hook.rerender({ contexts: [dark] }), "dark");
  assert.equal(
    failedBody(),
    "Your edits are kept. The preview shows the saved props.",
  );
});
