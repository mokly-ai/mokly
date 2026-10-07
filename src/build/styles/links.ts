import path from "node:path";

import { encodeUrlPath } from "@mokly/viewer/data";

import type { PublicFilePolicy } from "../../config/public_policy.js";
import type { PendingGeneratedFiles } from "../pending_generated.js";

/** Accepted generation's root routes and complete pending output set. */
export interface StyleDelivery {
  readonly routes: ReadonlyMap<string, string>;
  readonly pending: PendingGeneratedFiles;
  readonly policy?: PublicFilePolicy;
}

/** Encode a portable mockups-relative stylesheet path from one fragment. */
export function stylesheetHref(
  fragmentRoute: string,
  stylesheet: string,
): string {
  const relative = path.posix.relative(
    path.posix.dirname(fragmentRoute),
    stylesheet,
  );
  const encoded = encodeUrlPath(relative);
  return encoded.startsWith(".") ? encoded : `./${encoded}`;
}
