import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { BundleResult } from "../generated/sidecar/BundleResult.js";

import { SidecarError } from "./errors.js";
import { jsonText } from "./json.js";
import { FRAME_LIMIT } from "./transport.js";

function recipeBytes(
  params: BundleParams,
  result: BundleResult,
  encoding?: Map<object, string>,
): number {
  const id = "18446744073709551615";
  // Recipe members have no numbers. Key order cannot change their byte count.
  const text = (value: object) => {
    let encoded = encoding?.get(value);
    if (encoded === undefined) {
      encoded = encoding ? jsonText(value) : JSON.stringify(value);
      encoding?.set(value, encoded);
    }
    return encoded;
  };
  const shared =
    Buffer.byteLength(text(result.compiled)) +
    Buffer.byteLength(text(result.modules)) -
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
  encoding?: Map<object, string>,
): void {
  const bytes = recipeBytes(params, result, encoding);
  if (bytes > limit && result.plan) {
    delete result.plan;
    return checkRecipeSize(params, result, limit, encoding);
  }
  if (
    bytes > limit &&
    Object.keys(result.compiled.reuseEvidence.inputs).length
  ) {
    result.compiled.reuseEvidence = {
      complete: false,
      durable: false,
      inputs: {},
    };
    encoding?.delete(result.compiled);
    return checkRecipeSize(params, result, limit, encoding);
  }
  if (bytes > limit)
    throw new SidecarError(
      "bundle-failed",
      `Compiled bundle data needs ${bytes} bytes. The sidecar limit is ${limit} bytes. Reduce the bundle and retry.`,
    );
}
