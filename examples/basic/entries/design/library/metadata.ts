import { libraryStyleFiles, type LibraryStyle } from "./style_files.js";
export type LibraryGroup = "chrome" | "controls" | "inspector" | "preview";

const groupTitles: Record<LibraryGroup, string> = {
  chrome: "Chrome",
  controls: "Controls",
  inspector: "Inspector",
  preview: "Preview",
};

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
  style: LibraryStyle,
  title: string,
  description: string,
  /** Extra owned view modules in the same group, beyond `{style}.view.tsx`. */
  views: readonly string[] = [],
) {
  const directory = `examples/basic/entries/design/library/${group}`;
  const modules = [
    `${directory}/${style}.view.tsx`,
    ...views.map((view) => `${directory}/${view}`),
  ];
  const stylesheet = `examples/basic/${libraryStyleFiles[style]}`;
  return {
    id: `design-ui-${style}`,
    navPath: ["Design", "Shared components", groupTitles[group]],
    title,
    description,
    dependencies: [...modules, stylesheet],
    ownedDependencies: [...modules, stylesheet],
    relatedDocs: ["docs/protocol/mokly-design-component-library.md"],
    colorSchemes: DUAL_SCHEME_SAMPLES.has(style)
      ? (["light", "dark"] as const)
      : (["light"] as const),
  };
}
