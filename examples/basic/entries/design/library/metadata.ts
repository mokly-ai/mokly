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

/** Registration metadata is separate from implementation impact dependencies. */
export function libraryMetadata(
  group: LibraryGroup,
  slug: LibraryStyle,
  title: string,
  description: string,
  /** Extra owned view modules in the same group, beyond `{slug}.view.tsx`. */
  views: readonly string[] = [],
) {
  const directory = `examples/basic/entries/design/library/${group}`;
  const modules = [
    `${directory}/${slug}.view.tsx`,
    ...views.map((view) => `${directory}/${view}`),
  ];
  const stylesheet = `examples/basic/generated/${libraryStyleFiles[slug]}`;
  return {
    id: `design-ui-${slug}`,
    route: `design/library/${group}/${slug}.html`,
    title,
    description,
    dependencies: [...modules, stylesheet],
    ownedDependencies: [...modules, stylesheet],
    stylesheets: [libraryStyleFiles[slug]],
    relatedDocs: ["docs/protocol/mokly-design-component-library.md"],
    colorSchemes: DUAL_SCHEME_SAMPLES.has(slug)
      ? (["light", "dark"] as const)
      : (["light"] as const),
  };
}
