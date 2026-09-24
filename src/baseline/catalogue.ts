import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { BaselineError } from "./errors.js";

/** Pinned location and addressing layout for one historical catalogue. */
export interface BaselineCatalogue {
  readonly commit: string;
  readonly layout: "generated-v6" | "legacy";
  readonly catalogueRoot: string;
  readonly generatedRoot: string;
}

export function baselineCatalogue(
  commit: string,
  catalogueRoot: string,
  layout: BaselineCatalogue["layout"],
): BaselineCatalogue {
  if (catalogueRoot !== "." && !isSafeRepositoryPath(catalogueRoot))
    throw new BaselineError(
      "baseline-output-invalid",
      `Unsafe catalogue root: ${catalogueRoot}`,
    );
  return {
    commit,
    layout,
    catalogueRoot,
    generatedRoot:
      layout === "legacy"
        ? catalogueRoot
        : joinCataloguePath(catalogueRoot, ".generated"),
  };
}

export function joinCataloguePath(root: string, relative: string): string {
  return root === "." ? relative : path.posix.join(root, relative);
}

/** Reject untrusted IPC descriptors without inferring another layout in a child. */
export function parseBaselineCatalogue(
  value: unknown,
  commit: string,
): BaselineCatalogue | undefined {
  if (!value || typeof value !== "object") return;
  const record = value as Partial<BaselineCatalogue>;
  if (
    record.commit !== commit ||
    (record.layout !== "generated-v6" && record.layout !== "legacy") ||
    typeof record.catalogueRoot !== "string" ||
    typeof record.generatedRoot !== "string"
  )
    return;
  try {
    const parsed = baselineCatalogue(
      commit,
      record.catalogueRoot,
      record.layout,
    );
    return parsed.generatedRoot === record.generatedRoot ? parsed : undefined;
  } catch {
    return;
  }
}
