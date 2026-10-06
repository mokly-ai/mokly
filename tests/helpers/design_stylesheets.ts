/** Shared stylesheet scopes pinned by the real design catalogue. */
export const sharedDesignStylesheets = [
  ["design-components.css", 39, 69],
  ["design-component-inspection.css", 39, 69],
  ["design-component-details.css", 39, 69],
  ["design-component-inspector.css", "all-design", 69],
  ["design-component-workspace.css", "all-design", 69],
  ["design-component-view.css", 39, 69],
  ["design-component-controls.css", 11, 69],
  ["design.css", "all-design", 69],
  ["design-library.css", 0, 69],
] as const;

/** Owned stylesheet path for a shared design library component. */
export function libraryStylesheetPath(group: string, slug: string): string {
  return `examples/basic/generated/design-library/${group}/${slug}.css`;
}

/** `body` is a kept global selector, so each owned sheet retains evidence. */
export const libraryStylesheetMarker = "\nbody { outline-width: 3px; }\n";

/** `body` is a kept global selector, so each shared sheet retains evidence. */
export const sharedStylesheetMarker = "\nbody { gap: 17px; }\n";
