import { transform } from "lightningcss";

function scopeShellSelectors(styles) {
  return transform({
    code: Buffer.from(styles),
    filename: "shell.css",
    visitor: {
      Selector(selector) {
        let changed = false;
        let scoped = selector.map((component) => {
          const documentType =
            component.type === "type" &&
            (component.name === "html" || component.name === "body");
          const documentRoot =
            component.type === "pseudo-class" && component.kind === "root";
          if (!documentType && !documentRoot) return component;
          changed = true;
          return { type: "pseudo-class", kind: "scope" };
        });
        if (scoped[0]?.type === "class" && scoped[0].name === "mbk") {
          scoped = [{ type: "pseudo-class", kind: "scope" }, ...scoped];
          changed = true;
        }
        return changed ? scoped : undefined;
      },
    },
  }).code.toString();
}

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
  let scoped = scopeShellSelectors(
    shell
      .replace(/@font-face\s*\{[^}]*\}/, "")
      .replaceAll('"Inter"', '"Mokly Inter"'),
  );
  for (const [name, value] of defaults) {
    scoped = scoped
      .replace(new RegExp(`  ${name}: [^;]+;\\n`), "")
      .replaceAll(`var(${name})`, `var(${name}, ${value})`);
  }
  return `${font}\n@scope (.mokly-viewer) to ([data-mokly-slot]) {\n${scoped}\n}\n${extensions}`;
}
