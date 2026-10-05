import { componentEntrySource } from "./component_fixture.js";
import { componentReviewFixture } from "./component_review_fixture.js";

/** A compiled move fixture that also validates real reader, Serve and export delivery. */
export function moveReviewFixture(
  t: { after: (fn: () => Promise<void>) => void },
  change: (source: string) => string,
  source = componentEntrySource(),
  extraConfig = 'colorSchemes: ["light", "dark"],',
) {
  return componentReviewFixture(t, change, source, extraConfig, true);
}
