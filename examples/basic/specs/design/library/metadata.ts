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

/**
 * Registration metadata identifies the component's own public stylesheet.
 * `{group}/{slug}.tsx` holds the registration, schema and variants and only
 * forwards props and the viewport to `{slug}.view.tsx`, so registration and
 * fixture edits are metadata changes and view edits implementation changes.
 * No library module imports a screen registry or forms a circular variant
 * import.
 */
export function libraryMetadata(
  group: LibraryGroup,
  style: LibraryStyle,
  title: string,
  description: string,
) {
  return {
    slug: style,

    title,
    description,
    stylesheets: [libraryStyleFiles[style]],
    relatedDocs: ["docs/protocol/mokly-design-component-library.md"],
    colorSchemes: DUAL_SCHEME_SAMPLES.has(style)
      ? (["light", "dark"] as const)
      : (["light"] as const),
  };
}
