import { catalogueReleases } from "./catalogue-releases";
import { earlyReleases } from "./early-releases";
import { nativeReleases } from "./native-releases";
import type { Release } from "./release";
export const RELEASES: readonly Release[] = [
  ...nativeReleases,
  ...catalogueReleases,
  ...earlyReleases,
] as const satisfies readonly Release[];
