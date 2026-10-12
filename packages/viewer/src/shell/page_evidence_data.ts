/** The change status and stylesheet evidence that one page's Details show. */

import type { ResourceEvidence } from "../review/types.js";
import { publicEntryStatus } from "../viewer/public_workspace.js";

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import type { ShellContext } from "./context.js";
import type { EntryStatus } from "./view_status.js";

/** The comparison facts known for one current whole-document page. */
export interface PageComparisonEvidence {
  /** The status beside the page title; absent until Changes is ready. */
  status?: EntryStatus;
  /** The page's own changed files and examined exclusions, when it has any. */
  resources?: ResourceEvidence;
}

/**
 * Read a current page's facts from its published catalogue record or, when
 * the shell renders private data, from live classification. A page has no
 * views, so its one record is the whole evidence. A removed page, and Changes
 * that are not ready, have no facts.
 */
export function pageComparisonEvidence(
  catalogue: Catalogue,
  context: ShellContext,
  path: string,
): PageComparisonEvidence {
  const model = catalogue.publicModel;
  if (model) {
    const page = model.pages.find((item) => item.path === path);
    const status = page && publicEntryStatus(page);
    return status
      ? {
          status,
          ...(page.resourceEvidence
            ? { resources: page.resourceEvidence }
            : {}),
        }
      : {};
  }
  const current = catalogue.manifest.entries.find(
    (entry) => entry.kind === "page" && entry.path === path,
  );
  const snapshot = context.componentChanges;
  if (
    !current ||
    (snapshot === undefined && context.changedEntries === undefined)
  )
    return {};
  const live = snapshot?.pageEvidence?.find((item) => item.path === path);
  const { path: _path, ...resources } = live ?? { path };
  return {
    status:
      snapshot &&
      !branchPoints(catalogue).baselineEntry(current, snapshot.baseline.entries)
        ? "Added"
        : (snapshot?.changedEntries ?? context.changedEntries)?.includes(path)
          ? "Changed"
          : "Unmodified",
    ...(live ? { resources } : {}),
  };
}
