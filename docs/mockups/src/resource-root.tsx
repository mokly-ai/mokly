import type { ColorScheme, Viewport } from "@mokly/mokly";

import { useMockupRenderContext } from "./render-context";

/**
 * The relative path from a document up to the static build's generated root.
 * Mokly writes each view of entry `a/b/c` to
 * `static/mokly-generated/a/b/c/index.<viewport>[.dark].html`, so every path
 * segment, a variant's slug included, is one folder below that root.
 */
function generatedRoot(path: string): string {
  return "../".repeat(path.split("/").length);
}

/**
 * A repository file, such as a logo, addressed from the current document.
 * Mokly delivers an authored file at `static/{repository path}`, one folder
 * above the generated root, for example
 * `useRepositoryFile("docs/mockups/styles/email/mokly-logo-light.png")`.
 */
export function useRepositoryFile(path: string): string {
  return generatedRoot(useMockupRenderContext().path) + "../" + path;
}

/**
 * Another entry's generated document in one view, addressed from the current
 * document, for example `useEntryDocument("product/account/project-created",
 * "mobile", "dark")`.
 */
export function useEntryDocument(
  path: string,
  viewport: Viewport,
  colorScheme: ColorScheme,
): string {
  const scheme = colorScheme === "dark" ? ".dark" : "";
  return (
    generatedRoot(useMockupRenderContext().path) +
    path +
    "/index." +
    viewport +
    scheme +
    ".html"
  );
}
