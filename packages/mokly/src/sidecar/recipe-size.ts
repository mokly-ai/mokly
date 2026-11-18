import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { BundleResult } from "../generated/sidecar/BundleResult.js";

import { SidecarError } from "./errors.js";
import { FRAME_LIMIT } from "./transport.js";

function recipeBytes(params: BundleParams, result: BundleResult): number {
  const id = "18446744073709551615";
  // Recipe fields have no numbers; key order cannot change their byte length.
  const shared =
    Buffer.byteLength(JSON.stringify(result.compiled)) +
    Buffer.byteLength(JSON.stringify(result.modules)) -
    2 * "null".length;
  const response = `{"id":${id},"result":${JSON.stringify({ ...result, compiled: null, modules: null })}}`;
  const restore = `{"id":${id},"method":"restoreGeneration","params":${JSON.stringify({ generation: result.generation, params, compiled: null, modules: null })}}`;
  return (
    shared + Math.max(Buffer.byteLength(response), Buffer.byteLength(restore))
  );
}

/** Both private envelopes must fit the transport before a generation becomes live. */
export function checkRecipeSize(
  params: BundleParams,
  result: BundleResult,
  limit = FRAME_LIMIT,
): void {
  const bytes = recipeBytes(params, result);
  if (
    bytes > limit &&
    Object.keys(result.compiled.reuseEvidence.inputs).length
  ) {
    result.compiled.reuseEvidence = {
      complete: false,
      durable: false,
      inputs: {},
    };
    return checkRecipeSize(params, result, limit);
  }
  if (bytes > limit)
    throw new SidecarError(
      "bundle-failed",
      `Compiled bundle data needs ${bytes} bytes. The sidecar limit is ${limit} bytes. Reduce the bundle and retry.`,
    );
}
