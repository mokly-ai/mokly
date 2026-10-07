/** Configure one graph-scoped stylesheet processor and its cleanup boundary. */
import {
  FileSystemPostcssConfigLoader,
  type PostcssConfigLoader,
} from "../../config/postcss_loader.js";
import type { ResolvedConfig } from "../../config/types.js";

import { IsolatedPostcssProcessor } from "./isolated_postcss.js";
import { PostcssStyleProcessor } from "./postcss.js";
import { StylePreprocessor } from "./preprocess.js";

/** Keep production plugin packages isolated while retaining injected loader seams. */
export async function createStyleProcessor(
  config: ResolvedConfig,
  loader: PostcssConfigLoader,
  signal?: AbortSignal,
): Promise<{ preprocessor: StylePreprocessor; close: () => Promise<void> }> {
  signal?.throwIfAborted();
  const isolated =
    config.postcss && loader instanceof FileSystemPostcssConfigLoader
      ? new IsolatedPostcssProcessor(config)
      : undefined;
  let cancellation: Promise<void> | undefined;
  const abort = () => {
    cancellation ??= isolated?.close();
    void cancellation?.catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  const close = async () => {
    signal?.removeEventListener("abort", abort);
    await (cancellation ?? isolated?.close());
  };
  try {
    signal?.throwIfAborted();
    await isolated?.start();
    signal?.throwIfAborted();
    const plugins =
      config.postcss && !isolated ? await loader.load(config) : [];
    return {
      preprocessor: new StylePreprocessor(
        config,
        isolated ??
          (config.postcss
            ? new PostcssStyleProcessor(config, plugins)
            : undefined),
      ),
      close,
    };
  } catch (error) {
    await close();
    signal?.throwIfAborted();
    throw error;
  }
}
