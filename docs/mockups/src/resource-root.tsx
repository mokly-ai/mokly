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
