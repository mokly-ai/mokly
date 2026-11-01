/** The component stylesheets of `@mokly/ui` and the package stylesheet. */

/** The first line of `styles.css`; the component rules follow it. */
const HEADER =
  "/* @mokly/ui: the rules of every component, in the order of src/styles.css. */\n";

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

/** Listed components first, then omitted components in name order. */
export function orderedStylesheets(stylesheets, imports, warn) {
  const available = new Map(stylesheets.map((sheet) => [sheet.file, sheet]));
  const ordered = new Map();
  const list = imports.replace(/\/\*[^]*?\*\//gu, "");
  for (const match of list.matchAll(/@import\s+["']([^"']+)["']\s*;/gu)) {
    const file = match[1].replace(/^\.\//u, "");
    const sheet = available.get(file);
    if (sheet) ordered.set(file, sheet);
    else
      warn(
        `warning: src/styles.css lists src/${file}, which is not an existing component stylesheet. The package skips it.\n`,
      );
  }
  for (const sheet of [...stylesheets].sort(byName)) {
    if (ordered.has(sheet.file)) continue;
    warn(
      `warning: src/styles.css omits src/${sheet.file}. The package adds it at the end in component name order.\n`,
    );
    ordered.set(sheet.file, sheet);
  }
  return [...ordered.values()];
}

/** `styles.css`: the unchanged header, then the rules in the given order. */
export function packageStylesheet(stylesheets) {
  return stylesheets.reduce(
    (styles, { css }) => styles + (css.endsWith("\n") ? css : `${css}\n`),
    HEADER,
  );
}
