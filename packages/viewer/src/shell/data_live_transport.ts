/** Serve's live transport as the shell renders through it. */

import { ComponentRenderError } from "../components/render_types.js";

import type { ShellLiveSource } from "./data_source.js";

/**
 * Forward every call to Serve's live transport. A render that Serve answers
 * with 409 (`stale-revision`) reports the revision it carried before the
 * error reaches its edit owner, so the shell can adopt the newer publication
 * also while the event stream is down.
 */
export function staleAwareLiveSource(
  live: ShellLiveSource,
  stale: (revision: number) => void,
): ShellLiveSource {
  return {
    loadDescriptor: (signal) => live.loadDescriptor(signal),
    subscribe: (listener) => live.subscribe(listener),
    async render(descriptor, request, signal) {
      try {
        return await live.render(descriptor, request, signal);
      } catch (error) {
        if (
          error instanceof ComponentRenderError &&
          error.code === "stale-revision"
        )
          stale(request.revision);
        throw error;
      }
    },
    previewExpired: (previewUrl, signal) =>
      live.previewExpired(previewUrl, signal),
  };
}
