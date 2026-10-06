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
): Promise<{ preprocessor: StylePreprocessor; close: () => Promise<void> }> {
  const isolated =
    config.postcss && loader instanceof FileSystemPostcssConfigLoader
      ? new IsolatedPostcssProcessor(config)
      : undefined;
  try {
    await isolated?.start();
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
      close: async () => {
        await isolated?.close();
      },
    };
  } catch (error) {
    await isolated?.close();
    throw error;
  }
}
