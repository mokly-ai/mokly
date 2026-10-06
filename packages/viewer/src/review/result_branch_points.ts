/** Translate validated review sides into the shared catalogue lookup inputs. */

import { branchPoints } from "../catalogue/branch_point.js";
import type { EntryIdentity } from "../catalogue/branch_point_types.js";
import type { CurrentPath, BranchPointPath } from "../catalogue/path_types.js";
import {
  readCurrentPath,
  readBranchPointPath,
} from "../catalogue/path_values.js";

import type {
  ComponentReview,
  ComponentVariantReview,
  ReviewResultV5,
  ScreenReviewV5,
} from "./component_types.js";

interface ReviewLookupEntry<
  Current extends string,
  Before extends string,
> extends EntryIdentity {
  readonly variantOf?: CurrentPath | BranchPointPath;
  readonly record:
    | ScreenReviewV5<Current, Before>
    | ComponentReview<Current, Before>
    | ComponentVariantReview<Current, Before>;
}

/** One review generation resolves context entries, variants and usage names. */
export function resultBranchPoints<
  Current extends string,
  Before extends string,
>(result: ReviewResultV5<Current, Before>) {
  const entries: ReviewLookupEntry<Current, Before>[] = [
    ...result.screens.map((record) => ({
      kind: "screen" as const,
      path: readCurrentPath(record.path),
      record,
    })),
    ...result.components.flatMap((record) => [
      {
        kind: "component" as const,
        path: readCurrentPath(record.path),
        record,
      },
      ...record.variants.map((variant) => ({
        kind: "component" as const,
        path: readCurrentPath(variant.path),
        variantOf: variant.after
          ? readCurrentPath(record.path)
          : readBranchPointPath(record.path),
        record: variant,
      })),
    ]),
  ];
  return branchPoints({
    manifest: { entries: entries.filter((entry) => entry.record.after) },
    removedEntries: entries
      .filter((entry) => !entry.record.after)
      .map((entry) => ({ entry })),
    moves: entries.flatMap(({ kind, path, record }) =>
      record.previousPath
        ? [
            {
              kind,
              path,
              previousPath: readBranchPointPath(record.previousPath),
            },
          ]
        : [],
    ),
  });
}
