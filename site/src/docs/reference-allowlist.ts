/**
 * The protocol documents published under Reference. Only the documents named
 * here are readable on the site; every other file under `docs/protocol` stays
 * in the repository and is linked on GitHub. The list is the allowlist fixed
 * by `docs/protocol/site-docs.md`.
 */

/** One published protocol document. */
export interface ReferenceDocument {
  /** Meta description and the lead under the title. */
  readonly description: string;
  /** Position in the Reference section, ascending. */
  readonly order: number;
  /** The last path segment of the published route. */
  readonly slug: string;
  /** Repository-relative path of the Markdown source. */
  readonly source: string;
  /** Page title and sidebar label; the source's own first heading is removed. */
  readonly title: string;
}

/** The directory every published document is read from. */
export const REFERENCE_DIRECTORY = "docs/protocol";

/** Every protocol document the site publishes, in Reference order. */
export const REFERENCE_DOCUMENTS: readonly ReferenceDocument[] = Object.freeze([
  {
    description:
      "How a hosting provider must serve an exported catalogue, and what the browser expects from it.",
    order: 1,
    slug: "export-delivery",
    source: "docs/protocol/mokly-export-delivery.md",
    title: "Static export delivery",
  },
  {
    description:
      "The ownership marker an export writes, and the inventory a receiver validates it against.",
    order: 2,
    slug: "export-ownership",
    source: "docs/protocol/mokly-export-ownership.md",
    title: "Export ownership",
  },
  {
    description:
      "The upload contract a catalogue service implements: the request, the manifest and the limits.",
    order: 3,
    slug: "upload",
    source: "docs/protocol/mokly-upload.md",
    title: "Catalogue upload",
  },
  {
    description:
      "How links between catalogue entries resolve in generated files and in the catalogue itself.",
    order: 4,
    slug: "navigation",
    source: "docs/protocol/mokly-navigation.md",
    title: "Catalogue navigation",
  },
  {
    description:
      "The markup a styled control may use when it stands in for a catalogue link.",
    order: 5,
    slug: "link-controls",
    source: "docs/protocol/mokly-link-controls.md",
    title: "Styled link controls",
  },
  {
    description:
      "How a complete HTML document joins the catalogue beside screens and use-case flows.",
    order: 6,
    slug: "pages",
    source: "docs/protocol/mokly-pages.md",
    title: "Pages in the catalogue",
  },
]);

/** The file name of a published document inside the protocol directory. */
export function referenceFile(document: ReferenceDocument): string {
  return document.source.slice(REFERENCE_DIRECTORY.length + 1);
}

/** The published document a content collection entry id names. */
export function documentForEntry(id: string): ReferenceDocument | undefined {
  return REFERENCE_DOCUMENTS.find(
    (document) => referenceFile(document).replace(/\.md$/, "") === id,
  );
}

/** The published document a repository path belongs to, when it is published. */
export function publishedDocument(
  repositoryPath: string,
): ReferenceDocument | undefined {
  return REFERENCE_DOCUMENTS.find(
    (document) => document.source === repositoryPath,
  );
}

/** The site route a published document is read at. */
export function referenceRoute(slug: string): string {
  return `/docs/reference/${slug}/`;
}
