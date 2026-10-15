/** Validation of the render route's answers; nothing here enters catalogue data. */

import {
  readInstance,
  readProps,
  readRange,
  readSlot,
} from "../catalogue/component_values.js";
import { RENDER_ID, RENDERS_PATH } from "../catalogue/delivery_paths.js";
import { array, counter, object, string } from "../catalogue/values.js";
import {
  ComponentRenderError,
  renderStatus,
  type ComponentRenderRequest,
  type ComponentRenderSuccess,
  type RenderErrorCode,
} from "../components/render_types.js";

/** The code of each failed status, as `renderStatus` states it. */
const CODES = new Map(
  Object.entries(renderStatus).map(([code, status]) => [
    status,
    code as RenderErrorCode,
  ]),
);

/**
 * The typed error of one failed render answer. Its message is Serve's own,
 * when Serve sent one, for the details of the alert that shows it.
 */
export function renderFailure(
  status: number,
  message = "",
): ComponentRenderError {
  return new ComponentRenderError(
    CODES.get(status) ?? "render-failed",
    message,
  );
}

/** Serve's message of a failed answer, or nothing when it sent none. */
export async function failureMessage(response: Response): Promise<string> {
  try {
    const body = object(await response.json());
    return typeof body.message === "string" ? body.message : "";
  } catch {
    return "";
  }
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
