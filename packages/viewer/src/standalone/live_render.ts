/** Validation of the render route's answers; nothing here enters catalogue data. */

import {
  readInstance,
  readProps,
  readRange,
  readSlot,
} from "../catalogue/component_values.js";
import { RENDERS_PATH } from "../catalogue/delivery_paths.js";
import { array, counter, object, string } from "../catalogue/values.js";
import {
  ComponentRenderError,
  type ComponentRenderRequest,
  type ComponentRenderSuccess,
  type RenderErrorCode,
} from "../components/render_types.js";

const RENDER_ID = /^[A-Za-z0-9._~-]{1,256}$/;

const FAILURES: Readonly<Record<number, readonly [RenderErrorCode, string]>> = {
  400: ["invalid-input", "Check the prop values and their allowed limits."],
  403: ["forbidden", "Reload the catalogue to continue editing."],
  404: ["unknown-entry", "This entry is unavailable."],
  405: ["method", "The preview could not be updated. Try again."],
  409: ["stale-revision", "The catalogue changed. Try again."],
  410: ["expired", "The temporary preview expired. Try again."],
  413: ["too-large", "The prop values are too large."],
  422: [
    "render-failed",
    "The preview could not be rendered. Try again or reset the props.",
  ],
  429: ["capacity", "The renderer is busy. Try again shortly."],
};

/** The typed product error of one failed render status. */
export function renderFailure(status: number): ComponentRenderError {
  const [code, message] = FAILURES[status] ?? [
    "render-failed",
    "The preview could not be updated. Try again.",
  ];
  return new ComponentRenderError(code, message);
}

/**
 * Accept a render answer only for the revision and view it was asked for,
 * reading the fields the route defines and ignoring any other.
 */
export function readRenderResponse(
  value: unknown,
  request: ComponentRenderRequest,
): ComponentRenderSuccess {
  try {
    const input = object(value);
    const renderId = string(input.renderId);
    const previewUrl = string(input.previewUrl);
    const usage = object(input.usage);
    if (
      !RENDER_ID.test(renderId) ||
      counter(input.revision) !== request.revision ||
      !previewUrl.startsWith(`/${RENDERS_PATH}/${renderId}/`) ||
      new URL(previewUrl, "https://mokly.invalid").pathname !== previewUrl ||
      usage.status !== "ready"
    )
      throw new Error("mismatched render answer");
    return {
      renderId,
      revision: request.revision,
      previewUrl,
      props: readProps(input.props),
      usage: {
        status: "ready",
        instances: array(usage.instances).map(readInstance),
        slots: array(usage.slots).map(readSlot),
        ranges: array(usage.ranges).map(readRange),
      } as ComponentRenderSuccess["usage"],
    };
  } catch {
    throw new ComponentRenderError(
      "invalid-response",
      "The preview response could not be read. Try again.",
    );
  }
}
