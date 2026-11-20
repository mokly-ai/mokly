/** Read the package's published Reference inventory for both parity checks. */

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
