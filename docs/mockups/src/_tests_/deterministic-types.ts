/** Identify Date values and standard constructor signatures through the drawings checker. */

import path from "node:path";

import ts from "typescript";

import { unwrapped } from "./deterministic-access";

export type Reject = (node: ts.Node, message: string) => void;

const libraryDirectory = path.dirname(ts.getDefaultLibFilePath({}));

function standardDeclaration(node: ts.Node): boolean {
  const source = node.getSourceFile();
  return (
    source.isDeclarationFile &&
    path.dirname(source.fileName) === libraryDirectory
  );
}

export function isDateValue(checker: ts.TypeChecker, node: ts.Node): boolean {
  function date(type: ts.Type, seen = new Set<ts.Type>()): boolean {
    if (seen.has(type)) return false;
    seen.add(type);
    if (type.isUnionOrIntersection())
      return type.types.some((part) => date(part, seen));
    const symbol = type.getSymbol();
    if (
      symbol?.name === "Date" &&
      symbol.declarations?.some(standardDeclaration)
    )
      return true;
    const constraint = checker.getBaseConstraintOfType(type);
    if (constraint && constraint !== type && date(constraint, seen))
      return true;
    return type.getBaseTypes()?.some((base) => date(base, seen)) ?? false;
  }
  return date(checker.getTypeAtLocation(unwrapped(node)));
}

export function isDateConstructor(
  checker: ts.TypeChecker,
  expression: ts.Node,
): boolean {
  return checker
    .getTypeAtLocation(unwrapped(expression))
    .getConstructSignatures()
    .some((signature) => {
      const declaration = signature.getDeclaration();
      return (
        declaration &&
        ts.isInterfaceDeclaration(declaration.parent) &&
        declaration.parent.name.text === "DateConstructor" &&
        standardDeclaration(declaration)
      );
    });
}

/** Preserve standard API identity through function aliases. */
export function signatureIdentity(
  checker: ts.TypeChecker,
  node: ts.CallExpression | ts.NewExpression,
) {
  const declaration = checker.getResolvedSignature(node)?.getDeclaration();
  if (!declaration) return {};
  const owner = declaration.parent;
  const member = declaration.name;
  let container: ts.Node | undefined = owner;
  let intl = false;
  while (container) {
    if (ts.isModuleDeclaration(container) && container.name.text === "Intl")
      intl = true;
    container = container.parent;
  }
  return {
    method: member && ts.isIdentifier(member) ? member.text : undefined,
    constructorName:
      ts.isInterfaceDeclaration(owner) && standardDeclaration(declaration)
        ? (intl ? "Intl." : "") + owner.name.text.replace(/Constructor$/, "")
        : undefined,
  };
}
