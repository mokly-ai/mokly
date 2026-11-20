/** The Markdown pages that `apps/site` holds. Their root-relative links are site routes. */
export const siteContent = "apps/site/src/content/";

/** The protocol documents that the site publishes under `/docs/reference/{slug}/`. */
export const PUBLISHED_PROTOCOL_DOCUMENTS = [
  { slug: "export-delivery", source: "docs/protocol/mokly-export-delivery.md" },
  {
    slug: "export-ownership",
    source: "docs/protocol/mokly-export-ownership.md",
  },
  { slug: "upload", source: "docs/protocol/mokly-upload.md" },
  { slug: "upload-exchange", source: "docs/protocol/mokly-upload-exchange.md" },
  { slug: "navigation", source: "docs/protocol/mokly-navigation.md" },
  { slug: "link-controls", source: "docs/protocol/mokly-link-controls.md" },
  { slug: "pages", source: "docs/protocol/mokly-pages.md" },
] as const;

const docsPage =
  /^(?:apps\/site\/src\/content\/docs|docs\/guides)\/([^/]+)\/([^/]+)\.md$/;
const pages = "apps/site/src/pages/";
const publicFiles = "apps/site/public/";
const legal = "apps/site/src/content/legal/";

/**
 * Each route of the site, mapped to the listed repository file that renders
 * it. The site builds a static directory output with `trailingSlash:
 * "always"`: a static Astro page has a route that ends in a slash, an endpoint
 * or a public file has its own path, a docs page renders a cloud page, a Mokly
 * guide, or a published protocol document, and a one-segment page that shows
 * a legal document maps to the Markdown of that document.
 */
export function siteRoutes(
  files: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const routes = new Map<string, string>();
  for (const file of files) {
    const docs = docsPage.exec(file);
    const page = file.slice(pages.length);
    if (docs) routes.set(`/docs/${docs[1]}/${docs[2]}/`, file);
    else if (file.startsWith(publicFiles))
      routes.set(`/${file.slice(publicFiles.length)}`, file);
    else if (!file.startsWith(pages) || page.includes("[")) continue;
    else if (page.endsWith(".ts")) routes.set(`/${page.slice(0, -3)}`, file);
    else if (page === "404.astro") routes.set("/404.html", file);
    else if (page.endsWith(".astro"))
      routes.set(
        `/${page.slice(0, -".astro".length)}/`.replace(/(^|\/)index\/$/, "$1"),
        file,
      );
  }
  for (const { slug, source } of PUBLISHED_PROTOCOL_DOCUMENTS)
    if (files.has(source)) routes.set(`/docs/reference/${slug}/`, source);
  for (const [route, file] of routes) {
    const document = `${legal}${route.slice(1, -1)}.md`;
    if (file.endsWith(".astro") && files.has(document))
      routes.set(route, document);
  }
  return routes;
}
