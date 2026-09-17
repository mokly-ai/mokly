/** Progressive logical-fragment application for the static Browse preview. */

import { isLogicalFragment } from "../navigation/logical.js";

/** Apply one valid query fragment to every explicitly applicable frame. */
export function applyPreviewFragmentQuery(
  doc: Document,
  search: string,
): boolean {
  const values = new URLSearchParams(search).getAll("fragment");
  const fragment = values.length === 1 ? values[0] : undefined;
  if (!fragment || !isLogicalFragment(fragment)) return false;
  for (const frame of doc.querySelectorAll<HTMLIFrameElement>(
    "iframe[data-mokly-fragment-frame]",
  )) {
    for (const name of ["src", "data-fragment-light", "data-fragment-dark"]) {
      const source = frame.getAttribute(name);
      if (source !== null) frame.setAttribute(name, withHash(source, fragment));
    }
  }
  return true;
}

function withHash(source: string, fragment: string): string {
  const hash = source.indexOf("#");
  const base = hash < 0 ? source : source.slice(0, hash);
  return `${base}#${encodeURIComponent(fragment)}`;
}
