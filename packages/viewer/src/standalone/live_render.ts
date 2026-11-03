/**
 * The render route's request body and the delivery fences of its answers;
 * nothing here enters catalogue data.
 */

import { RENDER_ID, RENDERS_PATH } from "../catalogue/delivery_paths.js";
import { record } from "../components/data.js";
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
 * The JSON body of one render request. `JSON.stringify` writes negative zero
 * as `0`, so an edited `-0` would reach Serve as zero; this writer spells it
 * `-0`, which Serve reads back as negative zero, as prop values keep it.
 */
export function renderRequestBody(request: ComponentRenderRequest): string {
  return json(request);
}

/** `JSON.stringify` of plain request data, except that negative zero stays `-0`. */
function json(value: unknown): string {
  if (Object.is(value, -0)) return "-0";
  if (Array.isArray(value))
    return `[${value.map((item) => (item === undefined ? "null" : json(item))).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => `${JSON.stringify(key)}:${json(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

/**
 * The typed error of one failed render answer. Its message is Serve's own
 * generic message, when Serve sent one, kept as a diagnostic; the panel
 * shows its copy by the code.
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
    const body: unknown = await response.json();
    return record(body) && typeof body.message === "string" ? body.message : "";
  } catch {
    return "";
  }
}

/** Copy a render answer only for its requested revision and confined preview URL. */
export function readRenderResponse(
  value: unknown,
  request: ComponentRenderRequest,
): ComponentRenderSuccess {
  try {
    if (
      !record(value) ||
      typeof value.renderId !== "string" ||
      !RENDER_ID.test(value.renderId) ||
      value.revision !== request.revision ||
      typeof value.previewUrl !== "string" ||
      !value.previewUrl.startsWith(`/${RENDERS_PATH}/${value.renderId}/`) ||
      new URL(value.previewUrl, "https://mokly.invalid").pathname !==
        value.previewUrl
    )
      throw new Error("mismatched render answer");
    const content: unknown = structuredClone(value);
    return content as ComponentRenderSuccess;
  } catch {
    throw new ComponentRenderError(
      "invalid-response",
      "The preview response could not be read. Try again.",
    );
  }
}
