/** Validate package-authored Reference links while preserving guide content. */

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { HastPluginEntry } from "satteri";

import { GUIDE_CONTENT } from "./pages.js";
import { REFERENCE_DOCUMENTS } from "./reference-allowlist.js";

/** Check an authored Reference destination without changing its query or fragment. */
export function validateGuideReference(href: string, source: string): void {
  if (!href.startsWith("/docs/reference/")) return;
  const pathname = href.split(/[?#]/u)[0];
  const slug = /^\/docs\/reference\/([^/]+)\/$/u.exec(pathname ?? "")?.[1];
  if (!REFERENCE_DOCUMENTS.some((document) => document.slug === slug))
    throw new Error(
      `${source}: guide Reference link ${href} is not allowlisted`,
    );
}

/** Only Reference documents rewrite links. Package guides validate their authored URLs. */
export const guideDocument: HastPluginEntry = (context) => {
  if (!context.fileURL) return false;
  const source = fileURLToPath(context.fileURL);
  const relative = path.relative(GUIDE_CONTENT, source);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !relative.endsWith(".md")
  )
    return false;
  return {
    name: "mokly-guide-reference-links",
    element: {
      filter: ["a"],
      visit(node) {
        const href = node.properties?.["href"];
        if (typeof href === "string") validateGuideReference(href, relative);
      },
    },
  };
};
