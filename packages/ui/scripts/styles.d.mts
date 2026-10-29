/** One component stylesheet: its component name and its path below `src`. */
export interface ComponentStylesheet {
  name: string;
  file: string;
}

/** The component stylesheets among the source files, in component name order. */
export function componentStylesheets(
  files: readonly string[],
): ComponentStylesheet[];

/** `styles.css`: the header, then the rules of every component in name order. */
export function packageStylesheet(
  stylesheets: readonly { name: string; css: string }[],
): string;
