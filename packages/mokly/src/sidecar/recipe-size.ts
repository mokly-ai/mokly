import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { BundleResult } from "../generated/sidecar/BundleResult.js";

import { SidecarError } from "./errors.js";
import { jsonText } from "./json.js";
import { FRAME_LIMIT } from "./transport.js";

/** Both private envelopes must fit the transport before a generation becomes live. */
export function checkRecipeSize(
  params: BundleParams,
  result: BundleResult,
  limit = FRAME_LIMIT,
): void {
  const id = "18446744073709551615";
  const response = `{"id":${id},"result":${jsonText(result)}}`;
  const restore = `{"id":${id},"method":"restoreGeneration","params":${jsonText({ generation: result.generation, params, compiled: result.compiled, modules: result.modules })}}`;
  const bytes = Math.max(
    Buffer.byteLength(response),
    Buffer.byteLength(restore),
  );
  if (bytes > limit)
    throw new SidecarError(
      "bundle-failed",
      `Compiled bundle data needs ${bytes} bytes. The sidecar limit is ${limit} bytes. Reduce the bundle and retry.`,
    );
}
