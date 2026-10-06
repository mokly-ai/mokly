import type { Compilation } from "../../packages/mokly/dist/build/compile.js";
import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";
import type { ReadOnlyReviewRepository } from "../../packages/mokly/dist/review/repository.js";

import { componentEntrySource } from "./component_fixture.js";
import { componentReviewFixture } from "./component_review_fixture.js";
import type { TestFixture } from "./fixture.js";

type MoveReviewFixtureResult = TestFixture & {
  config: ResolvedConfig;
  before: Compilation;
  after: Compilation;
  git: ReadOnlyReviewRepository;
  changedPaths: string[];
};

/** A compiled move fixture that also validates real reader, Serve and export delivery. */
export function moveReviewFixture(
  t: { after: (fn: () => Promise<void>) => void },
  change: (source: string) => string,
  source = componentEntrySource(),
  extraConfig = 'colorSchemes: ["light", "dark"],',
): Promise<MoveReviewFixtureResult> {
  return componentReviewFixture(t, change, source, extraConfig, true);
}
