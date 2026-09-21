/** React-owned request lifecycle for a removed entry's previous version. */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { previewKey } from "../previews/descriptor.js";
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
  | { status: "ready"; loaded: LoadedPreview }
  | { status: "failed" };

interface OwnedState {
  key: string;
  selection: string;
  value: RemovedPreviewState;
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
  const loaded = useRef<{ key: string; value: LoadedPreview } | undefined>(
    undefined,
  );
  const retryRequested = useRef(false);
  const retry = useCallback(() => {
    retryRequested.current = true;
    bumpAttempt();
  }, []);

  useEffect(() => {
    if (!interactive || !environment) return;
    const controller = new AbortController();
    const current =
      loaded.current?.key === key ? loaded.current.value : undefined;
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
      let value = refresh ? undefined : current;
      if (value && delivery.kind === "live") {
        const renewed = await renewPreview(
          value,
          environment,
          controller.signal,
        );
        if (!owns()) return;
        if (!renewed) value = undefined;
      }
      if (!value) {
        setOwned({ key, selection, value: { status: "loading" } });
        if (!request) throw new Error("The previous version is unavailable.");
        value = await requestPreview(
          data,
          request,
          environment,
          controller.signal,
        );
      }
      if (!owns()) return;
      loaded.current = { key, value };
      retryRequested.current = false;
      setOwned({
        key,
        selection,
        value: { status: "ready", loaded: value },
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
