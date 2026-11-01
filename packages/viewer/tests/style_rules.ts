/**
 * The style rules of a stylesheet, parsed with lightningcss, and the check of
 * the UI package contract that no package rule selects a host page, an
 * element outside a component, or host slot content.
 */

import { transform } from "lightningcss";
import type { Selector, SelectorComponent } from "lightningcss";

/** The selectors of every style rule, at every depth, and every other rule. */
export function styleRules(css: string): {
  selectors: Selector[];
  atRules: string[];
} {
  const selectors: Selector[] = [];
  const atRules: string[] = [];
  transform({
    code: Buffer.from(css),
    filename: "styles.css",
    visitor: {
      Rule(rule) {
        if (rule.type === "style") selectors.push(...rule.value.selectors);
        else atRules.push(rule.type);
      },
    },
  });
  return { selectors, atRules };
}

/**
 * A stylesheet as lightningcss prints it, which merges equal neighbouring
 * rules and shortens selectors, as the embedded build does.
 */
export function printedStyles(css: string): string {
  return transform({
    code: Buffer.from(css),
    filename: "styles.css",
  }).code.toString();
}

const COMBINATORS: Record<string, string> = {
  child: " > ",
  descendant: " ",
  "later-sibling": " ~ ",
  "next-sibling": " + ",
  "pseudo-element": "",
};

const OPERATORS: Record<string, string> = {
  "dash-match": "|=",
  equal: "=",
  includes: "~=",
  prefix: "^=",
  substring: "*=",
  suffix: "$=",
};

/** The selector arguments of a pseudo-class such as `:where()`, if any. */
function argumentsOf(component: SelectorComponent): Selector[] {
  if (component.type !== "pseudo-class") return [];
  switch (component.kind) {
    case "any":
    case "has":
    case "is":
    case "not":
    case "where":
      return component.selectors;
    default:
      return [];
  }
}

function printComponent(component: SelectorComponent): string {
  switch (component.type) {
    case "combinator":
      return COMBINATORS[component.value] ?? ` ${component.value} `;
    case "universal":
      return "*";
    case "type":
      return component.name;
    case "id":
      return `#${component.name}`;
    case "class":
      return `.${component.name}`;
    case "attribute":
      return component.operation
        ? `[${component.name}${OPERATORS[component.operation.operator]}"${component.operation.value}"]`
        : `[${component.name}]`;
    case "pseudo-class": {
      const selectors = argumentsOf(component);
      return selectors.length
        ? `:${component.kind}(${selectors.map(printSelector).join(", ")})`
        : `:${component.kind}`;
    }
    case "pseudo-element":
      return `::${component.kind}`;
    default:
      return `{${component.type}}`;
  }
}

/** A selector as text, enough to name it in a failure. */
export function printSelector(selector: Selector): string {
  return selector.map(printComponent).join("");
}

/** Whether a selector names a class of the package: `.mbk`, `.mbk-…`, `.mokly-…`. */
function namesPackage(selector: Selector): boolean {
  return selector.some((component) =>
    component.type === "class"
      ? /^(?:mbk|mokly)(?:-|$)/u.test(component.name)
      : argumentsOf(component).some(namesPackage),
  );
}

const PAGE_TYPES = new Set(["html", "body"]);

/**
 * Each rule that can reach a host page or its content: a `@scope` block, a
 * selector of a document root or a scope, a selector of the page other than
 * the stub page rules of the document class, and a selector that names no
 * package class, such as a bare element or a generic class name, which a
 * host element can carry.
 */
export function pageRuleFailures(css: string): string[] {
  const { selectors, atRules } = styleRules(css);
  const failures = atRules
    .filter((kind) => kind === "scope")
    .map(() => "a @scope rule wraps package rules");
  for (const selector of selectors) {
    const text = printSelector(selector);
    const [first] = selector;
    const stub = first?.type === "class" && first.name === "mbk-document";
    if (
      selector.some(
        (component) =>
          component.type === "pseudo-class" &&
          (component.kind === "root" || component.kind === "scope"),
      )
    )
      failures.push(`${text} selects a document root or a scope`);
    else if (
      !stub &&
      selector.some(
        (component) =>
          component.type === "type" && PAGE_TYPES.has(component.name),
      )
    )
      failures.push(`${text} selects the page`);
    else if (!namesPackage(selector))
      failures.push(`${text} names no package class`);
  }
  return failures;
}
