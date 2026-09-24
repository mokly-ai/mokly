import { libraryStyleFiles, type LibraryStyle } from "./style_files.js";
export type LibraryGroup = "chrome" | "controls" | "inspector" | "preview";

/**
 * Samples whose own subject is the catalogue's appearance. They render in both
 * schemes so Browse's preview control switches them like the appearance
 * screens; the remaining samples stay light, as they were before.
 */
export const DUAL_SCHEME_SAMPLES = new Set<LibraryStyle>([
  "appearance-selector",
  "top-bar",
]);

/** Registration metadata identifies the component's own public stylesheet. */
export function libraryMetadata(
  group: LibraryGroup,
  slug: LibraryStyle,
  title: string,
  description: string,
) {
  return {
    id: `design-ui-${slug}`,
    route: `design/library/${group}/${slug}.html`,
    title,
    description,
    stylesheets: [libraryStyleFiles[slug]],
    relatedDocs: ["docs/protocol/mokly-design-component-library.md"],
    colorSchemes: DUAL_SCHEME_SAMPLES.has(slug)
      ? (["light", "dark"] as const)
      : (["light"] as const),
  };
}
