import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import * as ts from "typescript";

/**
 * Firna's solid badge fills under the white dark-scheme label of the
 * Canvas control theme cannot reach 4.5:1, so no product source may draw a
 * solid Firna badge. This Node-side scan reads the TypeScript sources and
 * reports each solid badge as `path:line`.
 */
export function solidBadgeFiles(directory: string): string[] {
  const problems: string[] = [];
  const files = readdirSync(directory, { recursive: true, encoding: "utf8" });
  for (const file of files.filter(
    (path) => /\.tsx?$/.test(path) && !path.split(/[\\/]/).includes("_tests_"),
  )) {
    const path = join(directory, file);
    const text = readFileSync(path, "utf8");
    if (!text.includes("@firna/ui/badge")) continue;
    const source = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const badges = new Set<string>();
    for (const node of source.statements) {
      if (
        !ts.isImportDeclaration(node) ||
        !ts.isStringLiteral(node.moduleSpecifier) ||
        node.moduleSpecifier.text !== "@firna/ui/badge"
      )
        continue;
      const imports = node.importClause?.namedBindings;
      if (imports && ts.isNamedImports(imports))
        for (const item of imports.elements)
          if ((item.propertyName ?? item.name).text === "Badge")
            badges.add(item.name.text);
      if (imports && ts.isNamespaceImport(imports))
        badges.add(imports.name.text + ".Badge");
    }
    if (badges.size === 0) continue;
    const bindings = new Map<string, ts.Expression>();
    function collect(node: ts.Node): void {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      )
        bindings.set(node.name.text, node.initializer);
      ts.forEachChild(node, collect);
    }
    collect(source);
    function contains(
      node: ts.Node,
      match: (node: ts.Node) => boolean,
      seen = new Set<ts.Node>(),
    ): boolean {
      if (seen.has(node)) return false;
      seen.add(node);
      if (match(node)) return true;
      const bound = ts.isIdentifier(node) ? bindings.get(node.text) : undefined;
      if (bound && contains(bound, match, seen)) return true;
      return (
        ts.forEachChild(
          node,
          (child) => contains(child, match, seen) || undefined,
        ) ?? false
      );
    }
    const namesSolid = (node: ts.Node) =>
      (ts.isStringLiteralLike(node) || ts.isIdentifier(node)) &&
      node.text === "solid";
    const solidVariant = (node: ts.Node) =>
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      node.name.text === "variant" &&
      contains(node.initializer, namesSolid);
    function visit(node: ts.Node): void {
      let solid = false;
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        badges.has(node.tagName.getText(source))
      )
        solid = node.attributes.properties.some((prop) =>
          ts.isJsxSpreadAttribute(prop)
            ? contains(prop.expression, solidVariant)
            : prop.name.getText(source) === "variant" &&
              prop.initializer !== undefined &&
              contains(prop.initializer, namesSolid),
        );
      if (
        ts.isCallExpression(node) &&
        /(?:^|\.)createElement$/.test(node.expression.getText(source))
      ) {
        const [badge, props] = node.arguments;
        solid ||=
          badge !== undefined &&
          props !== undefined &&
          badges.has(badge.getText(source)) &&
          contains(props, solidVariant);
      }
      if (solid)
        problems.push(
          path +
            ":" +
            (source.getLineAndCharacterOfPosition(node.getStart(source)).line +
              1),
        );
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return problems;
}
