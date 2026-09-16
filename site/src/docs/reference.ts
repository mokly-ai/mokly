/**
 * Publishing a protocol document. The allowlisted documents are read from
 * `docs/protocol` at build time and are never copied into the site, so the
 * published page and the repository stay one text. Their own first heading
 * becomes the page title, a link to another published document becomes its
 * site route, and a link to anything else in the repository becomes the file
 * on GitHub.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { HastPluginEntry } from "satteri";

import { REPOSITORY_ROOT } from "../workspace.js";

import { publishedDocument, referenceRoute } from "./reference-allowlist.js";

/** Where a repository path that is not published is read instead. */
export const GITHUB_BLOB = "https://github.com/mokly-ai/mokly/blob/main/";

/** The repository-relative POSIX path of an absolute path inside it. */
export function repositoryRelative(absolute: string): string {
  return path.relative(REPOSITORY_ROOT, absolute).split(path.sep).join("/");
}

/**
 * Where a link written inside a published document leads on the site. Absolute
 * URLs, other schemes and same-document fragments are left exactly as they
 * are written.
 */
export function rewriteHref(href: string, source: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  if (href.startsWith("//") || href.startsWith("#") || href.length === 0) {
    return href;
  }
  const hash = href.indexOf("#");
  const target = hash < 0 ? href : href.slice(0, hash);
  const fragment = hash < 0 ? "" : href.slice(hash);
  const resolved = target.startsWith("/")
    ? path.posix.normalize(target.slice(1))
    : path.posix.normalize(path.posix.join(path.posix.dirname(source), target));
  const published = publishedDocument(resolved);
  const base = published
    ? referenceRoute(published.slug)
    : `${GITHUB_BLOB}${resolved}`;
  return `${base}${fragment}`;
}

/** Every relative link one published document writes, in document order. */
export function relativeLinks(markdown: string): readonly string[] {
  return [...markdown.matchAll(/]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map(([, href]) => href ?? "")
    .filter(
      (href) =>
        href.length > 0 &&
        !href.startsWith("#") &&
        !/^[a-z][a-z0-9+.-]*:/i.test(href),
    );
}

/**
 * The Markdown pipeline plugin that publishes a protocol document: it drops
 * the document's own title heading, which the page renders itself, and sends
 * every repository link to the place the reader can open it.
 */
export const referenceDocument: HastPluginEntry = (context) => {
  const file = context.fileURL;
  const source = file ? repositoryRelative(fileURLToPath(file)) : undefined;
  if (!source || !publishedDocument(source)) return false;
  return {
    name: "mokly-reference-document",
    element: [
      {
        filter: ["h1"],
        visit(node, tree) {
          if (tree.parent(node)?.type === "root" && tree.indexOf(node) === 0) {
            tree.removeNode(node);
          }
        },
      },
      {
        filter: ["a"],
        visit(node, tree) {
          const href = node.properties?.["href"];
          if (typeof href === "string") {
            tree.setProperty(node, "href", rewriteHref(href, source));
          }
        },
      },
    ],
  };
};
