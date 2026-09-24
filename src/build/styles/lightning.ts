import { createRequire } from "node:module";

import type * as LightningCss from "lightningcss";

const requireLightning = createRequire(import.meta.url);
let lightning: typeof LightningCss | undefined;

/** Load Lightning CSS's native CommonJS transformer on first stylesheet use. */
export function lightningTransform(): (typeof LightningCss)["transform"] {
  lightning ??= requireLightning("lightningcss") as typeof LightningCss;
  return lightning.transform;
}
