import { libraryStyleFiles, type LibraryStyle } from "./style_files.js";
export type LibraryGroup = "chrome" | "controls" | "inspector" | "preview";

/**
 * Samples whose own subject is the catalogue's appearance. They render in both
 * schemes so Browse's preview control switches them like the appearance
 * screens; the remaining samples stay light, as they were before.
 */
const dualScheme = new Set<LibraryStyle>(["appearance-selector", "top-bar"]);

/** Registration metadata is separate from implementation impact dependencies. */
export function libraryMetadata(
  group: LibraryGroup,
  slug: LibraryStyle,
  title: string,
  description: string,
) {
  const view = `examples/basic/entries/design/library/${group}/${slug}.view.tsx`;
  const stylesheet = `examples/basic/generated/${libraryStyleFiles[slug]}`;
  return {
    id: `design-ui-${slug}`,
    route: `design/library/${group}/${slug}.html`,
    title,
    description,
    dependencies: [view, stylesheet],
    ownedDependencies: [view, stylesheet],
    relatedDocs: ["docs/protocol/mokly-design-component-library.md"],
    colorSchemes: dualScheme.has(slug)
      ? (["light", "dark"] as const)
      : (["light"] as const),
  };
}
