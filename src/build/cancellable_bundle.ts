/** Bound one esbuild invocation to the caller's compilation lifetime. */
import { setImmediate } from "node:timers/promises";

import { build, context, type BuildOptions, type BuildResult } from "esbuild";

type MemoryBuild = BuildOptions & { metafile: true; write: false };

/** Yield cancelled compilation between stages while preserving worker checkpoints. */
export function compilationCheckpoint(
  signal?: AbortSignal,
  accepted?: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    signal?.throwIfAborted();
    if (signal) await setImmediate();
    signal?.throwIfAborted();
    await accepted?.();
    signal?.throwIfAborted();
  };
}

export async function buildWithSignal(
  options: MemoryBuild,
  signal?: AbortSignal,
): Promise<BuildResult<MemoryBuild>> {
  if (!signal) return build(options);
  signal.throwIfAborted();
  const job = await context(options);
  let cancellation: Promise<void> | undefined;
  const cancel = () => {
    cancellation ??= job.cancel();
    void cancellation.catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    const result = await job.rebuild();
    signal.throwIfAborted();
    return result;
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    try {
      await cancellation;
    } finally {
      await job.dispose();
    }
  }
}
