/** Scope shell selectors and defaults to an embedding root, excluding host slots. */
export function embeddedStyles(shell, extensions) {
  const font = shell
    .match(/@font-face\s*\{[^}]*\}/)[0]
    .replaceAll('"Inter"', '"Mokly Inter"')
    .replace("/__mokly/fonts/", "./assets/fonts/");
  const defaults = new Map([
    ["--mokly-accent", "#4f7864"],
    ["--mokly-accent-contrast", "#ffffff"],
    ["--mokly-accent-soft", "rgba(79, 120, 100, 0.1)"],
  ]);
  let scoped = shell
    .replace(/@font-face\s*\{[^}]*\}/, "")
    .replaceAll('"Inter"', '"Mokly Inter"')
    .replace(/\b(?:html|body)\b|:root/g, ":scope");
  for (const [name, value] of defaults) {
    scoped = scoped
      .replace(new RegExp(`  ${name}: [^;]+;\\n`), "")
      .replaceAll(`var(${name})`, `var(${name}, ${value})`);
  }
  return `${font}\n@scope (.mokly-viewer) to ([data-mokly-slot]) {\n${scoped}\n}\n${extensions}`;
}
