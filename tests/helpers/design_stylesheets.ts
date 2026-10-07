/** Shared stylesheet scopes pinned by the real design catalogue. */
export const sharedDesignStylesheets = [
  ["design-components.css", 41, 69],
  ["design-component-inspection.css", 41, 69],
  ["design-component-details.css", 41, 69],
  ["design-component-inspector.css", "all-design", 69],
  ["design-component-workspace.css", "all-design", 69],
  ["design-component-view.css", 41, 69],
  ["design-component-controls.css", 11, 69],
  ["design.css", "all-design", 69],
  ["design-library.css", 0, 69],
] as const;

/** Owned stylesheet path for a shared design library component. */
export function libraryStylesheetPath(group: string, slug: string): string {
  return `examples/basic/design-library/${group}/${slug}.css`;
}

/** Authored path for one of the shared design stylesheets. */
export function sharedStylesheetPath(stylesheet: string): string {
  return `examples/basic/${stylesheet}`;
}

/** `body` is a kept global selector, so each shared sheet retains evidence. */
export const sharedStylesheetMarker = "\nbody { gap: 17px; }\n";
