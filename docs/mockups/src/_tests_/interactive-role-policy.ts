import ts from "typescript";

import type { SourceFile } from "./source-policy";

const interactiveRoles = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "radiogroup",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "tablist",
  "textbox",
  "tree",
  "treeitem",
]);

function documentRole(node: ts.Node, tag: string): boolean {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text
      .split(/\s+/)
      .every(
        (role) =>
          !interactiveRoles.has(role) || (tag === "a" && role === "link"),
      );
  if (ts.isIdentifier(node)) return node.text === "undefined";
  if (node.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node))
    return documentRole(node.expression, tag);
  if (ts.isConditionalExpression(node))
    return (
      documentRole(node.whenTrue, tag) && documentRole(node.whenFalse, tag)
    );
  return false;
}

/** A literal `tabIndex` value, or nothing when the value is not a literal. */
function literalTabIndex(
  value: ts.JsxAttributeValue | undefined,
): string | undefined {
  if (!value) return undefined;
  if (ts.isStringLiteral(value)) return value.text;
  if (!ts.isJsxExpression(value) || !value.expression) return undefined;
  const expression = value.expression;
  if (ts.isNumericLiteral(expression)) return expression.text;
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  )
    return "-" + expression.operand.text;
  return undefined;
}

/** The literal string one attribute of an element holds, if it holds one. */
function literalAttribute(
  attributes: ts.JsxAttributes,
  wanted: string,
  source: ts.SourceFile,
): string | undefined {
  for (const prop of attributes.properties) {
    if (!ts.isJsxAttribute(prop) || prop.name.getText(source) !== wanted)
      continue;
    const value = prop.initializer;
    if (value && ts.isStringLiteral(value)) return value.text;
    if (
      value &&
      ts.isJsxExpression(value) &&
      value.expression &&
      ts.isStringLiteral(value.expression)
    )
      return value.expression.text;
  }
  return undefined;
}

/**
 * Whether a `tabIndex` keeps plain HTML a document element. A negative value
 * only lets a handler hand focus to the element — the build card's title
 * after Cancel — or takes a frame out of the tab order, so the element stays
 * out of keyboard navigation. Zero is allowed only on a region with an
 * accessible name, which a keyboard reader focuses to scroll, as the build
 * card's output box is; any other value makes plain HTML a control.
 */
function documentFocus(
  attributes: ts.JsxAttributes,
  value: ts.JsxAttributeValue | undefined,
  source: ts.SourceFile,
): boolean {
  const index = literalTabIndex(value);
  if (index === "-1") return true;
  if (index !== "0") return false;
  return (
    literalAttribute(attributes, "role", source) === "region" &&
    Boolean(
      literalAttribute(attributes, "aria-labelledby", source) ??
      literalAttribute(attributes, "aria-label", source),
    )
  );
}

/** Screen authors compose controls; raw HTML retains document semantics only. */
export function interactiveRoleViolations(file: SourceFile): string[] {
  const source = ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (/^[a-z]/.test(tag)) {
        for (const prop of node.attributes.properties) {
          if (!ts.isJsxAttribute(prop)) continue;
          const name = prop.name.getText(source);
          if (
            ["aria-selected", "aria-pressed"].includes(name) ||
            (name === "tabIndex" &&
              !documentFocus(node.attributes, prop.initializer, source)) ||
            /^on[A-Z]/.test(name)
          )
            violations.push(
              file.path + ": interactive HTML requires a registered control",
            );
          if (name === "role" || name === "accessibilityRole") {
            const value = prop.initializer;
            const expression =
              value && ts.isJsxExpression(value) ? value.expression : value;
            if (expression && !documentRole(expression, tag))
              violations.push(
                file.path + ": interactive role requires a registered control",
              );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return violations;
}
