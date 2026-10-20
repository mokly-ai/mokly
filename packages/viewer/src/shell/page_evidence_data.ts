/** The change status and stylesheet evidence that one page's Details show. */

import type { EvidenceReasons } from "../review/types.js";
import { viewEvidenceReasons } from "../review/view_evidence.js";
import { publicEntryStatus } from "../viewer/public_workspace.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { EntryStatus } from "./view_status.js";

/** The comparison facts known for one current whole-document page. */
export interface PageComparisonEvidence {
  /** The status beside the page title; absent until Changes is ready. */
  status?: EntryStatus;
  /** The page's own changed files and examined exclusions, when it has any. */
  resources?: EvidenceReasons;
}

/**
 * Read a current page's facts from its published catalogue record. A page has
 * no views, so its one record is the whole evidence. A catalogue without
 * published records knows only the context's Changes list, so it shows a
 * status and no evidence. A removed page, and Changes that are not ready,
 * have no facts.
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
            ? { resources: viewEvidenceReasons(page.resourceEvidence) }
            : {}),
        }
      : {};
  }
  const current = catalogue.manifest.entries.some(
    (entry) => entry.kind === "page" && entry.path === path,
  );
  if (!current || context.changedEntries === undefined) return {};
  return {
    status: context.changedEntries.includes(path) ? "Changed" : "Unmodified",
  };
}
