import { libraryStyleFiles, type LibraryStyle } from "./style_files.js";
export type LibraryGroup = "chrome" | "controls" | "inspector" | "preview";

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
    relatedDocs: ["docs/protocol/mokly-design-component-library.md"],
    colorSchemes: ["light"] as const,
  };
}
