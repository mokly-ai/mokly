/** One component stylesheet: its component name and its path below `src`. */
export interface ComponentStylesheet {
  name: string;
  file: string;
}

/** The component stylesheets among the source files, in component name order. */
export function componentStylesheets(
  files: readonly string[],
): ComponentStylesheet[];

/** Listed components first, then omitted components in name order. */
export function orderedStylesheets(
  stylesheets: readonly ComponentStylesheet[],
  imports: string,
  warn: (message: string) => void,
): ComponentStylesheet[];

/** `styles.css`: the unchanged header, then the rules in the given order. */
export function packageStylesheet(
  stylesheets: readonly { name: string; css: string }[],
): string;
