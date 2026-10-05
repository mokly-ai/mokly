/** The stage of a removed component parent whose variants all moved. */

import { viewHref } from "../navigation/routes.js";

import type { Catalogue, CatalogueManifestEntry } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";

/**
 * Name each moved variant at its new place. Each keeps its own history there,
 * so the stage sends the reader to it instead of to a comparison that this
 * page cannot show. When other entries took every former variant's path, only
 * the heading remains.
 */
export function MovedVariantsStage({
  catalogue,
  entry,
}: {
  catalogue: Catalogue;
  entry: CatalogueManifestEntry;
}) {
  const lookup = branchPoints(catalogue);
  const moved = lookup.movedVariants(entry);
  return (
    <div
      className="mbk-empty"
      data-mokly-stage=""
      data-viewport="both"
      data-workspace-moved-variants=""
    >
      <h2>This component was removed</h2>
      {moved.length > 0 ? (
        <>
          <p>
            {moved.length === 1
              ? "Its variant moved to a new place."
              : "Its variants moved to new places."}
          </p>
          <ul className="mbk-empty-links">
            {moved.map((variant) => {
              const parent = lookup.parent({
                source: "current",
                entry: variant,
              });
              const parentTitle =
                parent === undefined
                  ? undefined
                  : "entry" in parent
                    ? parent.entry.title
                    : parent.title;
              return (
                <li key={variant.path}>
                  <a
                    className="mbk-empty-link"
                    data-moved-variant={variant.path}
                    href={viewHref(variant.path)}
                  >
                    {parentTitle === undefined
                      ? variant.title
                      : `${parentTitle} › ${variant.title}`}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
