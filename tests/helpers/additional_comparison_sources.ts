import { addBranchPointSources } from "./branch_point_sources.js";
import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { addMovedFixtureSources } from "./moved_fixture_sources.js";

/** Extra sources belong only to the branch copy and the private Serve fixture. */
export const addComparisonFixtureSources: ComparisonAdditions = async (
  root,
  side,
) => {
  await addBranchPointSources(root, side);
  await addMovedFixtureSources(root, side);
};
