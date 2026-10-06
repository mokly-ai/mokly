import type { MoklyConfig } from "./types.js";

/** Preserve inference while declaring a typed Mokly configuration. */
export function defineConfig<const Config extends MoklyConfig>(
  config: Config,
): Config {
  return config;
}
