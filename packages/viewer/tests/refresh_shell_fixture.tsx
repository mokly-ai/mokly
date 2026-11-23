import type { TestContext } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, cleanup, render } from "@testing-library/react";

import type { FrameAdapter, FrameEvent, InstanceBoundary } from "@mokly/frame";
import type { CatalogueReadModel, CatalogueUsage } from "@mokly/model";

import { routeFromUrl } from "../src/shell/routes.js";
import { ShellStoreProvider } from "../src/shell/store.js";
import { StandaloneShellContents } from "../src/standalone/shell.js";

import { FakeDataSource, flush } from "./data_fakes.js";
import {
  HOME_URL,
  ORIGIN,
  publish,
  type DetailPair,
} from "./refresh_publication_fixtures.js";

export function registerShellDocument(t: TestContext, path = HOME_URL): void {
  GlobalRegistrator.register({
    url: new URL(path, ORIGIN).href,
    settings: {
      enableIframePageLoading: true,
      fetch: {
        interceptor: {
          beforeAsyncRequest: async ({ window }) =>
            new window.Response("<!doctype html><title>Preview</title>", {
              headers: { "content-type": "text/html" },
            }),
        },
      },
    },
  });
  t.after(async () => {
    cleanup();
    await GlobalRegistrator.unregister();
  });
}

interface MountedPreview {
  frame: HTMLIFrameElement;
  receive: ((event: FrameEvent) => void) | undefined;
  updates: CatalogueUsage[];
  highlighted: readonly string[];
  clearedOnUpdate: (readonly string[])[];
}

function recordingAdapter(boundaries: readonly InstanceBoundary[]) {
  const mounts: MountedPreview[] = [];
  const adapter: FrameAdapter = {
    async mount(frame, view) {
      const mounted: MountedPreview = {
        frame,
        receive: view.onEvent,
        updates: [],
        highlighted: [],
        clearedOnUpdate: [],
      };
      mounts.push(mounted);
      return {
        async updateUsage(usage) {
          mounted.updates.push(usage);
          mounted.clearedOnUpdate.push(mounted.highlighted);
          mounted.highlighted = [];
        },
        async highlight(keys) {
          mounted.highlighted = [...keys];
        },
        async listInstanceBoundaries() {
          return boundaries;
        },
        async scrollTo() {},
        subscribe: () => () => {},
        dispose() {},
      };
    },
  };
  return { adapter, mounts };
}

export async function renderPublicationShell(
  index: CatalogueReadModel,
  details: readonly DetailPair[],
  boundaries: readonly InstanceBoundary[] = [],
) {
  const source = new FakeDataSource(true);
  const { adapter, mounts } = recordingAdapter(boundaries);
  const view = render(
    <ShellStoreProvider
      context={{ embedded: false }}
      frameAdapter={adapter}
      frameBaseUrl={ORIGIN}
      index={index}
      initialDetails={details}
      interactive
      route={(catalogue) =>
        routeFromUrl(catalogue, new URL(window.location.href))
      }
      source={source}
    >
      <StandaloneShellContents />
    </ShellStoreProvider>,
  );
  await act(flush);
  return {
    view,
    mounts,
    publish: (next: CatalogueReadModel, ...held: DetailPair[]) =>
      act(() => publish(source, next, held)),
  };
}
