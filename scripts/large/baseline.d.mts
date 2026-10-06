import type {
  BaselineClock,
  BaselineFileSystem,
  BaselineProcessRunner,
} from "../../packages/mokly/src/baseline/types.js";
import type { ResolvedConfig } from "../../packages/mokly/src/config/types.js";
import type { RepositoryEvidence } from "../../packages/mokly/src/review/git.js";

export function resetFixtureBaseline(
  config: Pick<ResolvedConfig, "repoRoot" | "review">,
  dependencies?: {
    fs?: BaselineFileSystem;
    runner?: BaselineProcessRunner;
    clock?: BaselineClock;
    evidence?: RepositoryEvidence;
  },
): Promise<void>;
