import { isDeepStrictEqual } from "node:util";

import * as esbuildApi from "esbuild";

import { KeptContext } from "../../packages/mokly/src/sidecar/kept-context.js";

/** A kept context whose esbuild contexts the test counts. */
export function countedKept() {
  const counts = { created: 0, disposed: 0 };
  const kept = new KeptContext(async (options) => {
    counts.created += 1;
    const context = await esbuildApi.context(options);
    const dispose = context.dispose.bind(context);
    return Object.assign(context, {
      dispose: async () => {
        counts.disposed += 1;
        await dispose();
      },
    });
  });
  return { kept, counts };
}

/**
 * The paths of the fields that differ, down to `depth` levels, with the key
 * order of objects ignored, as the sidecar's wire encoding sorts keys. A test
 * asserts on this short list, so that its failure never prints whole bundles.
 */
export function differingFields(
  left: unknown,
  right: unknown,
  depth = 3,
  prefix = "",
): string[] {
  if (isDeepStrictEqual(left, right)) return [];
  if (
    depth === 0 ||
    typeof left !== "object" ||
    typeof right !== "object" ||
    left === null ||
    right === null ||
    Array.isArray(left) ||
    Array.isArray(right)
  )
    return [prefix || "(value)"];
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return keys
    .sort()
    .flatMap((key) =>
      differingFields(
        Reflect.get(left, key),
        Reflect.get(right, key),
        depth - 1,
        prefix ? `${prefix}.${key}` : key,
      ),
    );
}
