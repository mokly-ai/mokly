import fs from "node:fs";

import { readCatalogue } from "../src/catalogue/reader.js";

export const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v5.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

export function htmlIds(html: string): Set<string> {
  return new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]!),
  );
}

export function htmlReferences(html: string): string[] {
  return [
    ...html.matchAll(
      /\s(?:aria-controls|aria-describedby|aria-labelledby|for)="([^"]+)"|\shref="#([^"]+)"/g,
    ),
  ].flatMap((match) => (match[1] ?? match[2]!).split(" "));
}
