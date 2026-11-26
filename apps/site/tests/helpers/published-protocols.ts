/** Expected Reference membership and order from the site docs contract. */
export const PUBLISHED_PROTOCOLS = [
  [
    "docs/protocol/mokly-export-delivery.md",
    "export-delivery",
    "Static export delivery",
  ],
  [
    "docs/protocol/mokly-export-ownership.md",
    "export-ownership",
    "Export ownership",
  ],
  ["docs/protocol/mokly-upload.md", "upload", "Catalogue upload"],
  [
    "docs/protocol/mokly-upload-exchange.md",
    "upload-exchange",
    "Catalogue upload exchange",
  ],
  ["docs/protocol/mokly-navigation.md", "navigation", "Catalogue navigation"],
  [
    "docs/protocol/mokly-link-controls.md",
    "link-controls",
    "Styled link controls",
  ],
  ["docs/protocol/mokly-pages.md", "pages", "Pages in the catalogue"],
] as const;

export interface PublishedProtocol {
  readonly order: number;
  readonly source: string;
  readonly slug: string;
}

/** A malformed inventory fails instead of silently dropping a document. */
export function publishedProtocols(
  markdown: string,
): readonly PublishedProtocol[] {
  const section = markdown
    .split(/^## Published Protocol Documents\s*$/mu)[1]
    ?.split(/^## /mu)[0];
  if (section === undefined)
    throw new Error("Missing Published Protocol Documents section");
  const lines = section.split("\n");
  const start = lines.findIndex((line) => line.trim().startsWith("|"));
  const table = start < 0 ? [] : lines.slice(start);
  const end = table.findIndex((line) => line.trim().length === 0);
  const [header, separator, ...rows] = (
    end < 0 ? table : table.slice(0, end)
  ).map((line) => line.trim());
  if (
    !/^\|\s*Order\s*\|\s*Package source\s*\|\s*Reference slug\s*\|$/u.test(
      header ?? "",
    ) ||
    !/^\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|$/u.test(separator ?? "") ||
    rows.length === 0
  ) {
    throw new Error("Invalid Published Protocol Documents table");
  }
  return rows.map((line) => {
    const match =
      /^\|\s*([1-9]\d*)\s*\|\s*`(docs\/protocol\/[a-z0-9-]+\.md)`\s*\|\s*`([a-z0-9-]+)`\s*\|$/u.exec(
        line,
      );
    if (!match) throw new Error(`Invalid published protocol row: ${line}`);
    return {
      order: Number(match[1]),
      source: match[2] ?? "",
      slug: match[3] ?? "",
    };
  });
}
