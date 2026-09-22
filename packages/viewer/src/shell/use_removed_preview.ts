/** React-owned request lifecycle for a removed entry's previous version. */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { previewKey } from "../previews/descriptor.js";
import {
  createPreviewPresentationLoader,
  type PreviewPresentation,
  type PreviewPresentationLoader,
} from "../previews/presentation.js";
import {
  previewEndpoint,
  renewPreview,
  requestPreview,
  type LoadedPreview,
} from "../previews/request.js";

import { useComparisonEnvironment } from "./comparison_context.js";
import type { RemovedPreviewData } from "./previews.js";

/** Display state for one route-owned previous-version request. */
export type RemovedPreviewState =
  | { status: "unavailable" }
  | { status: "loading" }
  | {
      status: "ready";
      loaded: LoadedPreview;
      presentations: ReadonlyMap<string, PreviewPresentation>;
    }
  | { status: "failed" };

interface OwnedState {
  key: string;
  selection: string;
  value: RemovedPreviewState;
}

interface LoadedOwner {
  environment: NonNullable<ReturnType<typeof useComparisonEnvironment>>;
  key: string;
  loader: PreviewPresentationLoader;
  request: string;
  value: LoadedPreview;
}

function selectedAddresses(
  loaded: LoadedPreview,
  viewport: "both" | "desktop" | "mobile",
  colorScheme: "dark" | "light",
): readonly string[] {
  if (loaded.content.kind === "page") return [loaded.content.url];
  const viewports =
    viewport === "both"
      ? (["mobile", "desktop"] as const)
      : ([viewport] as const);
  return viewports.flatMap((selected) => {
    if (loaded.content.kind !== "screen") return [];
    const view =
      loaded.content.views.find(
        (candidate) =>
          candidate.viewport === selected &&
          candidate.colorScheme === colorScheme,
      ) ??
      loaded.content.views.find(
        (candidate) =>
          candidate.viewport === selected && candidate.colorScheme === "light",
      );
    return view ? [view.url] : [];
  });
}

/** Load only the preview selected by this shell and fence superseded work. */
export function useRemovedPreview({
  colorScheme,
  data,
  interactive,
  viewport,
}: {
  colorScheme: "dark" | "light";
  data: RemovedPreviewData;
  interactive: boolean;
  viewport: "both" | "desktop" | "mobile";
}): { retry(): void; state: RemovedPreviewState } {
  const environment = useComparisonEnvironment();
  const key = previewKey(data);
  const selection = `${viewport}:${colorScheme}`;
  const [attempt, bumpAttempt] = useReducer((value: number) => value + 1, 0);
  const [owned, setOwned] = useState<OwnedState | undefined>(undefined);
  const loaded = useRef<LoadedOwner | undefined>(undefined);
  const retryRequested = useRef(false);
  const retry = useCallback(() => {
    retryRequested.current = true;
    bumpAttempt();
  }, []);

  useEffect(() => {
    if (!interactive || !environment) return;
    const controller = new AbortController();
    const refresh = retryRequested.current;
    const owns = () => !controller.signal.aborted;
    const load = async (): Promise<void> => {
      const delivery = environment.delivery();
      const request = previewEndpoint(
        data,
        delivery.kind === "pinned" ? delivery : undefined,
        String(environment.baseUrl),
        refresh,
      );
      const requestKey = request
        ? `${request.endpoint.href}:${request.generation?.href ?? ""}`
        : "";
      let owner =
        !refresh &&
        loaded.current?.key === key &&
        loaded.current.environment === environment &&
        loaded.current.request === requestKey
          ? loaded.current
          : undefined;
      if (owner && delivery.kind === "live") {
        const renewed = await renewPreview(
          owner.value,
          environment,
          controller.signal,
        );
        if (!owns()) return;
        if (!renewed) owner = undefined;
      }
      if (!owner) {
        loaded.current = undefined;
        setOwned({ key, selection, value: { status: "loading" } });
        if (!request) throw new Error("The previous version is unavailable.");
        const value = await requestPreview(
          data,
          request,
          environment,
          controller.signal,
        );
        if (!owns()) return;
        owner = {
          environment,
          key,
          loader: createPreviewPresentationLoader(value, delivery, {
            baseUrl: environment.baseUrl,
            fetch: (input, init) => environment.fetch(input, init),
            parse: (source) =>
              new DOMParser().parseFromString(source, "text/html"),
          }),
          request: requestKey,
          value,
        };
        loaded.current = owner;
      }
      const presentations = await Promise.all(
        selectedAddresses(owner.value, viewport, colorScheme).map((address) =>
          owner.loader.load(address, controller.signal),
        ),
      );
      if (!owns()) return;
      loaded.current = owner;
      retryRequested.current = false;
      setOwned({
        key,
        selection,
        value: {
          status: "ready",
          loaded: owner.value,
          presentations: new Map(
            presentations.map((presentation) => [
              presentation.snapshotAddress,
              presentation,
            ]),
          ),
        },
      });
    };
    void load().catch(() => {
      if (!owns()) return;
      loaded.current = undefined;
      retryRequested.current = false;
      setOwned({ key, selection, value: { status: "failed" } });
    });
    return () => controller.abort();
  }, [
    attempt,
    colorScheme,
    environment,
    interactive,
    key,
    selection,
    viewport,
  ]);

  return {
    retry,
    state:
      owned?.key === key
        ? owned.selection === selection
          ? owned.value
          : { status: "loading" }
        : { status: "unavailable" },
  };
}
