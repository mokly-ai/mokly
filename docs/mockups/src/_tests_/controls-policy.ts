import ts from "typescript";

import type { SourceFile } from "./source-policy";

function isSemanticColor(node: ts.Node | undefined): boolean {
  if (!node) return false;
  if (ts.isJsxExpression(node)) return isSemanticColor(node.expression);
  if (ts.isConditionalExpression(node))
    return isSemanticColor(node.whenTrue) && isSemanticColor(node.whenFalse);
  return (
    ts.isStringLiteral(node) &&
    [
      "default",
      "secondary",
      "muted",
      "placeholder",
      "primary",
      "danger",
      "inverse",
    ].includes(node.text)
  );
}

/** Shared controls must retain the library's rendering and theme boundary. */
export function controlSourceViolations(file: SourceFile): string[] {
  const source = ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const controls = new Set<string>();
  const typography = new Set<string>();
  const violations: string[] = [];
  const staticSiteSource = file.path.startsWith("screens/design/site/");
  for (const node of source.statements) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.startsWith("@firna/ui/")
    ) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const binding of bindings.elements) {
          controls.add(binding.name.text);
          if (node.moduleSpecifier.text === "@firna/ui/typography")
            typography.add(binding.name.text);
        }
    }
  }
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(source);
      if (
        !staticSiteSource &&
        ["button", "input", "textarea", "select"].includes(name)
      )
        violations.push(file.path + ": use a registered Firna control");
      if (controls.has(name))
        for (const prop of node.attributes.properties) {
          if (!ts.isJsxAttribute(prop)) continue;
          const key = prop.name.getText(source);
          if (
            /style|className/i.test(key) ||
            (key === "color" &&
              !(typography.has(name) && isSemanticColor(prop.initializer)))
          )
            violations.push(
              file.path + ": theme shared controls instead of styling them",
            );
        }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return violations;
}

/** Old primitive selectors and RNW atomic selectors would create a second theme. */
export function controlCssViolations(css: string): string[] {
  const violations: string[] = [];
  // A comment is not part of the selector that follows it.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim();
    if (
      /\.(?:button(?:-[\w-]+)?|field|field-error|badge(?:-[\w-]+)?|avatar|status-dot)(?=[\s,.:#>+~[]|$)/.test(
        selector,
      ) ||
      /(?:^|[\s,>+~])(?:button|input|textarea)(?=[\s,.:#>+~[]|$)/.test(
        selector,
      ) ||
      /\.(?:css|r)-[\w-]+/.test(selector) ||
      /\[data-testid/.test(selector)
    )
      violations.push("shared control selector: " + selector);
  }
  return violations;
}
