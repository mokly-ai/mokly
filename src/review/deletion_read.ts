import type { FileLocation } from "../config/file_locations.js";

/** Only the verified-deletion policy consumes a listed authored file's missing state. */
export type DeletionAssetRead =
  | {
      readonly kind: "present";
      readonly bytes: Uint8Array;
      readonly location?: FileLocation;
    }
  | { readonly kind: "missing"; readonly location?: FileLocation }
  | { readonly kind: "absent" };
