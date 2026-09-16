/** Request cancellation and response/context validation for temporary previews. */
import type {
  ComponentRenderRequest,
  ComponentRenderSuccess,
  RenderCapability,
  GeneratedComponentView,
} from "@mokly/viewer/data";
import { localFramePath } from "@mokly/viewer/runtime";

export async function requestComponentPreview(
  request: ComponentRenderRequest,
  capability: RenderCapability,
  view: GeneratedComponentView,
  signal: AbortSignal,
): Promise<ComponentRenderSuccess> {
  const response = await fetch("/__mokly/components/render", {
    method: "POST",
    credentials: "same-origin",
    signal,
    headers: {
      "content-type": "application/json",
      "x-mokly-render-token": capability.token,
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "Check the prop values and their allowed limits.",
      403: "Reload the catalogue to continue editing.",
      404: "This component or variant is unavailable.",
      409: "The catalogue changed. Reload to continue editing.",
      413: "The prop values are too large.",
      422: "The preview could not be rendered. Try again or reset the props.",
      429: "The renderer is busy. Try again shortly.",
    };
    throw new Error(
      messages[response.status] ??
        "The preview could not be updated. Try again.",
    );
  }
  const result = (await response.json()) as ComponentRenderSuccess;
  if (
    !result ||
    !/^[a-f0-9]{48}\.[a-f0-9]{64}$/.test(result.renderId) ||
    result.generation !== capability.generation ||
    result.previewUrl !==
      `/__mokly/components/renders/${result.renderId}/${view.path.split("/").map(encodeURIComponent).join("/")}` ||
    result.view?.viewport !== view.viewport ||
    result.view.colorScheme !== view.colorScheme ||
    !Array.isArray(result.view.instances) ||
    !Array.isArray(result.view.ranges) ||
    !result.props
  )
    throw new Error("The preview response could not be read. Try again.");
  return result;
}

/** Check only the immediate authenticated transient document after it loads. */
export async function componentPreviewExpired(
  frame: HTMLIFrameElement,
  previews: Iterable<ComponentRenderSuccess>,
  signal: AbortSignal,
): Promise<boolean> {
  const preview = [...previews].find(
    (result) => localFramePath(frame) === result.previewUrl,
  );
  if (!preview) return false;
  const response = await fetch(preview.previewUrl, {
    method: "HEAD",
    signal,
    cache: "no-store",
  });
  return response.status === 410;
}
