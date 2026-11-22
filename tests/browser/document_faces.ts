import type { Locator } from "@playwright/test";

/** The viewer's two face files, beneath `mokly-viewer/fonts/` of each delivery. */
export const VIEWER_FACE_FILES = [
  "Geist-Variable.woff2",
  "GeistMono-Variable.woff2",
] as const;

/**
 * Load a Markdown document's Geist and Geist Mono faces, then read the status of
 * each face and the font files that the document fetched. A face reports
 * `loaded` only when its own file loads, so an installed font cannot pass.
 */
export function documentFaces(root: Locator) {
  // Font loading has no user-facing handle, so the document's font set is read.
  return root.evaluate(async () => {
    await Promise.allSettled([
      document.fonts.load('16px "Geist"'),
      document.fonts.load('16px "Geist Mono"'),
    ]);
    return {
      faces: [...document.fonts].map(
        (face) => `${face.family.replaceAll('"', "")}: ${face.status}`,
      ),
      files: performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => name.endsWith(".woff2"))
        .sort(),
    };
  });
}

/** The two faces after they load, and the viewer files beneath `fonts`. */
export function loadedViewerFaces(fonts: string) {
  return {
    faces: ["Geist: loaded", "Geist Mono: loaded"],
    files: VIEWER_FACE_FILES.map((file) => new URL(file, fonts).href),
  };
}
