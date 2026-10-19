/** The private Serve routes: the live descriptor, the event stream and renders. */

import {
  EVENTS_PATH,
  LIVE_PATH,
  RENDERS_PATH,
} from "../catalogue/delivery_paths.js";
import { readLiveDescriptor } from "../catalogue/live_reader.js";
import type { ShellLiveSource } from "../shell/data_source.js";
import { fetchJson } from "../viewer/sources.js";

import type { StandaloneWindow } from "./data_source.js";
import {
  failureMessage,
  readRenderResponse,
  renderFailure,
  renderRequestBody,
} from "./live_render.js";

const DEPLOYMENT = /^[a-f0-9]{64}$/;
const REVISION = /^(?:0|[1-9][0-9]*)$/;

/** Serve's live routes on the stub's own origin. */
export function standaloneLiveSource(win: StandaloneWindow): ShellLiveSource {
  const root = new URL("/", win.location.href);
  return {
    async loadDescriptor(signal) {
      const { value } = await fetchJson(
        new URL(LIVE_PATH, root),
        signal,
        win.fetch,
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
      source.onmessage = (event) => {
        failed = false;
        const revision = event.lastEventId;
        const deploymentId = event.data;
        if (
          typeof revision !== "string" ||
          !REVISION.test(revision) ||
          !Number.isSafeInteger(Number(revision)) ||
          typeof deploymentId !== "string" ||
          !DEPLOYMENT.test(deploymentId)
        )
          return;
        listener.message(Number(revision), deploymentId);
      };
      source.onerror = () => {
        if (failed) return;
        failed = true;
        listener.unavailable();
      };
      return () => source.close();
    },
    async render(descriptor, request, signal) {
      const response = await win.fetch(new URL(descriptor.render.url, root), {
        method: "POST",
        credentials: "same-origin",
        signal,
        headers: {
          "content-type": "application/json",
          "x-mokly-render-token": descriptor.render.token,
        },
        body: renderRequestBody(request),
      });
      if (!response.ok)
        throw renderFailure(response.status, await failureMessage(response));
      return readRenderResponse(await response.json(), request);
    },
    async previewExpired(previewUrl, signal) {
      const url = new URL(previewUrl, root);
      if (
        url.origin !== root.origin ||
        !url.pathname.startsWith(`/${RENDERS_PATH}/`)
      )
        return false;
      const response = await win.fetch(url, {
        method: "HEAD",
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      return response.status === 410;
    },
  };
}
