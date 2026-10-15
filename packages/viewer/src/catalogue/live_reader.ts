/** The live descriptor v3 reader: the version gate first, then the capability. */

import { invalidData, record } from "../components/data.js";

import { VIEWER_DIRECTORY } from "./delivery_paths.js";
import type { LiveDescriptorV3 } from "./types.js";
import { hash, object, string } from "./values.js";
import { MoklyVersionError } from "./version_error.js";

/** The only live descriptor number this viewer reads. */
const LIVE_DESCRIPTOR_VERSION = 3;

/** The one route that accepts a live render request. */
export const RENDER_ROUTE = `/${VIEWER_DIRECTORY}/components/render` as const;

/**
 * Gate the version and read the render generation and capability; any other
 * field a newer writer adds is ignored.
 */
export function readLiveDescriptor(value: unknown): LiveDescriptorV3 {
  const version = record(value) ? value.schemaVersion : undefined;
  if (version !== LIVE_DESCRIPTOR_VERSION)
    throw new MoklyVersionError("live", version, LIVE_DESCRIPTOR_VERSION);
  const input = object(value);
  const render = object(input.render);
  const token = string(render.token);
  if (render.url !== RENDER_ROUTE || !token)
    invalidData("$live", "invalid render capability");
  return {
    schemaVersion: LIVE_DESCRIPTOR_VERSION,
    generation: hash(input.generation),
    render: { url: RENDER_ROUTE, token },
  };
}
