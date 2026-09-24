import path from "node:path";

import { encodeUrlPath } from "@mokly/viewer/data";

/** Use configured local stylesheet encoding for declared files as well. */
export function localStylesheetHref(
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
