/** Load Lightning CSS without asking the ESM loader to pre-parse CommonJS exports. */
import { createRequire } from "node:module";

import type * as LightningCss from "lightningcss";

const lightningCss = createRequire(import.meta.url)(
  "lightningcss",
) as typeof LightningCss;

/** Transform CSS through Lightning CSS's native CommonJS implementation. */
export const transform: (typeof LightningCss)["transform"] =
  lightningCss.transform;
