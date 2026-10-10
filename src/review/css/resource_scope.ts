import type { ComponentMaterialReader } from "../component_resources.js";

/** Stylesheet applicability follows CSS imports, never crosses an embedded document. */
export async function documentStylesheetScope(
  documents: readonly {
    reader: ComponentMaterialReader;
    path: string;
    html: string;
    insertedStylesheets?: readonly string[];
  }[],
  identity: (route: string) => string,
): Promise<ReadonlySet<string>> {
  const routes = await Promise.all(
    documents.map(({ reader, path, html, insertedStylesheets }) =>
      reader.stylesheets(path, html, insertedStylesheets),
    ),
  );
  return new Set(routes.flatMap((paths) => [...paths].map(identity)));
}
