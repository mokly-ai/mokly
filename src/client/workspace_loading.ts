/** Load only displayed saved views; missing usage never becomes a fictional empty record. */
import type { ComponentViewRecord } from "@mokly/viewer";
import type { GeneratedComponentView } from "@mokly/viewer/data";
import type { WorkspaceData } from "@mokly/viewer/server";

export function workspaceLoader(
  data: WorkspaceData,
  signal: AbortSignal,
  changed: () => void,
): (views: readonly GeneratedComponentView[]) => void {
  const requested = new Set<string>();
  return (views) => {
    if (!data.previewGeneration || signal.aborted) return;
    for (const view of views) {
      if (view.usage || requested.has(view.path)) continue;
      requested.add(view.path);
      const url = `/__mokly/views/${view.path.split("/").map(encodeURIComponent).join("/")}?generation=${data.previewGeneration}`;
      void fetch(url, { signal })
        .then(async (response) => {
          if (!response.ok) return;
          const result = (await response.json()) as {
            route: string;
            generation: string;
            usage?: ComponentViewRecord;
          };
          if (
            signal.aborted ||
            result.generation !== data.previewGeneration ||
            result.route !== view.path ||
            result.usage?.viewport !== view.viewport ||
            result.usage.colorScheme !== view.colorScheme
          )
            return;
          data.views = data.views.map((previous) =>
            previous.path === view.path
              ? { ...previous, usage: result.usage! }
              : previous,
          );
          changed();
        })
        .catch(() => {});
    }
  };
}
