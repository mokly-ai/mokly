import { transform } from "lightningcss";

import { VIEWER_DIRECTORY } from "@mokly/viewer/data";

/** The container that an embedded root's top host establishes. */
const TOP_HOST_CONTAINER = "mokly-top-host";

/** The start of a parsed rule, which names a top-level rule of one parse. */
function start({ loc }) {
  return `${loc.source_index}:${loc.line}:${loc.column}`;
}

/** Whether a parsed selector starts with the embedded root class. */
function startsAtRoot(selector) {
  const [first] = selector;
  return first?.type === "class" && first.name === VIEWER_DIRECTORY;
}

/**
 * Whether a rule belongs to the embedded root, outside the scope that stops at
 * host slots: a style rule whose every selector starts with the root class,
 * an `@scope` from the root class, a `@media` rule that holds only such rules,
 * and a container query of the root's top host.
 */
function rootRule(rule) {
  const { value } = rule;
  switch (rule.type) {
    case "style":
      return value.selectors.every(startsAtRoot);
    case "scope":
      return (
        Boolean(value.scopeStart?.length) &&
        value.scopeStart.every(startsAtRoot)
      );
    case "media":
      return value.rules.length > 0 && value.rules.every(rootRule);
    case "container":
      return value.name === TOP_HOST_CONTAINER;
    default:
      return false;
  }
}

/** Visit the top-level rules only, and drop each that `keep` rejects. */
function topLevelRules(keep) {
  let topLevel = new Set();
  return {
    StyleSheet(sheet) {
      topLevel = new Set(
        sheet.rules.flatMap((rule) =>
          rule.value?.loc ? [start(rule.value)] : [],
        ),
      );
    },
    Rule(rule) {
      if (!rule.value?.loc || !topLevel.has(start(rule.value)))
        return undefined;
      return keep(rule) ? undefined : [];
    },
  };
}

/** The shell rules inside the scope, with document selectors scoped to it. */
function scopeShellSelectors(styles) {
  return transform({
    code: Buffer.from(styles),
    filename: "shell.css",
    visitor: {
      ...topLevelRules((rule) => !rootRule(rule)),
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

/** The rules of the embedded root, in their order, without the others. */
function rootRules(styles) {
  return transform({
    code: Buffer.from(styles),
    filename: "shell.css",
    visitor: topLevelRules(rootRule),
  }).code.toString();
}

/**
 * Scope shell selectors and defaults to an embedding root, excluding host
 * slots. The rules of the root itself follow the scope in their order, so
 * they reach the root, and its host slots keep the host's styles.
 */
export function embeddedStyles(shell) {
  const font = shell
    .match(/@font-face\s*\{[^}]*\}/)[0]
    .replaceAll('"Inter"', '"Mokly Inter"')
    .replace(`/${VIEWER_DIRECTORY}/fonts/`, "./assets/fonts/");
  const rules = shell
    .replace(/@font-face\s*\{[^}]*\}/, "")
    .replaceAll('"Inter"', '"Mokly Inter"');
  // Dropping the public declarations lets a host value on an ancestor inherit
  // in. Each use then falls back to the matching default, which the palette
  // restates per appearance, so an un-overridden dark root is not pinned Light.
  const overridable = new Map([
    ["--mokly-accent", "--_mokly-private-accent-default"],
    ["--mokly-accent-contrast", "--_mokly-private-accent-contrast-default"],
    ["--mokly-accent-soft", "--_mokly-private-accent-soft-default"],
  ]);
  let styles = `@scope (.${VIEWER_DIRECTORY}) to ([data-mokly-slot]) {\n${scopeShellSelectors(rules)}\n}\n${rootRules(rules)}`;
  for (const [name, fallback] of overridable) {
    styles = styles
      .replaceAll(new RegExp(`  ${name}: [^;]+;\\n`, "g"), "")
      .replaceAll(`var(${name})`, `var(${name}, var(${fallback}))`);
  }
  return `${font}\n${styles}`;
}
