/** The private Serve routes: the live descriptor, the event stream and renders. */

import { VIEWER_DIRECTORY } from "@mokly/model";

import { EVENTS_PATH, LIVE_PATH } from "../catalogue/delivery_paths.js";
import { readLiveDescriptor } from "../catalogue/live_reader.js";
import { fetchJson } from "../catalogue/sources.js";
import type { ShellLiveSource } from "../shell/data_source.js";

import { ownOriginFetch, type StandaloneWindow } from "./data_source.js";
import {
  failureMessage,
  readRenderResponse,
  renderFailure,
  renderRequestBody,
} from "./live_render.js";

/** Serve's live routes on the stub's own origin. */
export function standaloneLiveSource(win: StandaloneWindow): ShellLiveSource {
  const root = new URL("/", win.location.href);
  return {
    async loadDescriptor(signal) {
      const { value } = await fetchJson(
        new URL(LIVE_PATH, root),
        signal,
        ownOriginFetch(win),
      );
      return readLiveDescriptor(value);
    },
    subscribe(listener) {
      let source: EventSource;
      try {
        if (!win.EventSource) throw new Error("EventSource is unavailable.");
        source = new win.EventSource(new URL(EVENTS_PATH, root));
      } catch {
        listener.unavailable();
        return () => {};
      }
      let failed = false;
      source.onmessage = (event: MessageEvent<string>) => {
        failed = false;
        listener.message(Number(event.lastEventId), event.data);
      };
      source.onerror = () => {
        if (failed) return;
        failed = true;
        listener.unavailable();
      };
      return () => source.close();
    },
    async render(descriptor, request, signal) {
      const response = await win.fetch(
        new URL(`${VIEWER_DIRECTORY}/components/render`, root),
        {
          method: "POST",
          credentials: "same-origin",
          signal,
          headers: {
            "content-type": "application/json",
            "x-mokly-render-token": descriptor.render.token,
          },
          body: renderRequestBody(request),
        },
      );
      if (!response.ok)
        throw renderFailure(response.status, await failureMessage(response));
      return readRenderResponse(await response.json(), request);
    },
    async previewExpired(previewUrl, signal) {
      const response = await win.fetch(new URL(previewUrl, root), {
        method: "HEAD",
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      return response.status === 410;
    },
  };
}
