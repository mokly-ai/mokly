import type { FileLocation } from "../config/file_locations.js";
import { MoklyError } from "../errors.js";

import { MissingInventoryAsset } from "./asset_inventory.js";
import type { OptionalReviewAssetReader, ReviewAssetReader } from "./assets.js";
import { decideReferencedResource } from "./deleted_resource.js";

/** Preserve physical identity while the shared policy proves a possible deletion. */
export async function decideLocatedResource(
  route: string,
  before: ReviewAssetReader,
  after: OptionalReviewAssetReader,
) {
  let location: FileLocation | undefined;
  let missingHead = false;
  const decision = await decideReferencedResource(
    route,
    {
      readIfExists: (file) => before.readIfExists?.(file) ?? before.read(file),
      ...(before.readForDeletion
        ? { readForDeletion: before.readForDeletion.bind(before) }
        : {}),
    },
    {
      readIfExists: async (file) => {
        const value = await after.readLocated(file);
        location = value.location;
        missingHead = value.content === undefined;
        return value.content;
      },
      ...(after.readForDeletion
        ? {
            readForDeletion: async (file: string) => {
              const value = await after.readForDeletion!(file);
              if (value.kind !== "absent") location = value.location;
              missingHead = value.kind === "missing";
              return value;
            },
          }
        : {}),
    },
  ).catch((error: unknown) => {
    if (missingHead && error instanceof MissingInventoryAsset)
      throw new MoklyError(
        "review-invalid",
        `referenced resource is missing: ${route}`,
      );
    throw error;
  });
  if (decision.kind === "present" && !location)
    location = (await after.readLocated(route)).location;
  return { decision, location };
}
