/** Scope shell selectors and defaults to an embedding root, excluding host slots. */
export function embeddedStyles(shell, extensions) {
  const font = shell
    .match(/@font-face\s*\{[^}]*\}/)[0]
    .replaceAll('"Inter"', '"Mokly Inter"')
    .replace("/__mokly/fonts/", "./assets/fonts/");
  // Dropping the public declarations lets a host value on an ancestor inherit
  // in. Each use then falls back to the matching default, which the palette
  // restates per appearance, so an un-overridden dark root is not pinned Light.
  const overridable = new Map([
    ["--mokly-accent", "--_mokly-private-accent-default"],
    ["--mokly-accent-contrast", "--_mokly-private-accent-contrast-default"],
    ["--mokly-accent-soft", "--_mokly-private-accent-soft-default"],
  ]);
  let scoped = shell
    .replace(/@font-face\s*\{[^}]*\}/, "")
    .replaceAll('"Inter"', '"Mokly Inter"')
    .replace(/\b(?:html|body)\b|:root/g, ":scope");
  for (const [name, fallback] of overridable) {
    scoped = scoped
      .replaceAll(new RegExp(`  ${name}: [^;]+;\\n`, "g"), "")
      .replaceAll(`var(${name})`, `var(${name}, var(${fallback}))`);
  }
  return `${font}\n@scope (.mokly-viewer) to ([data-mokly-slot]) {\n${scoped}\n}\n${extensions}`;
}
