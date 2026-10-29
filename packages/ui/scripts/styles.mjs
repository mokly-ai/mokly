/** The component stylesheets of `@mokly/ui` and the package stylesheet. */

/** The first line of `styles.css`; the component rules follow it. */
const HEADER =
  "/* @mokly/ui: the rules of every component, in component name order. */\n";

/** Compare UTF-16 code units, so that no locale changes the order. */
function byName(first, second) {
  if (first.name < second.name) return -1;
  return first.name > second.name ? 1 : 0;
}

/**
 * The component stylesheets among the source files: each `{name}/{name}.css`,
 * as a POSIX path below `src`, in component name order.
 */
export function componentStylesheets(files) {
  return files
    .flatMap((file) => {
      const match = /^([^/]+)\/\1\.css$/u.exec(file);
      return match ? [{ name: match[1], file }] : [];
    })
    .sort(byName);
}

/** `styles.css`: the header, then the rules of every component in name order. */
export function packageStylesheet(stylesheets) {
  return [...stylesheets]
    .sort(byName)
    .reduce(
      (styles, { css }) => styles + (css.endsWith("\n") ? css : `${css}\n`),
      HEADER,
    );
}
