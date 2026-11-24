import { catalogueReleases } from "./catalogue-releases";
import { earlyReleases } from "./early-releases";
import { nativeReleases } from "./native-releases";
import type { Release } from "./release";

/** The depicted releases, newest first: 0.19.0 back to 0.9.0. */
export const RELEASES: readonly Release[] = [
  ...nativeReleases,
  ...catalogueReleases,
  ...earlyReleases,
] as const satisfies readonly Release[];
