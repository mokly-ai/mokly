import ts from "typescript";

import { pathSides } from "./branch_point_type_values.js";

export function displayExpression(node: ts.Node): boolean {
  let parent = node.parent;
  while (
    ts.isParenthesizedExpression(parent) ||
    ts.isTemplateSpan(parent) ||
    ts.isTemplateExpression(parent)
  )
    parent = parent.parent;
  return ts.isJsxExpression(parent);
}

/** Binding a typed class method keeps the receiver and its stored fields intact. */
export function boundReceiver(
  value: ts.Expression,
  checker: ts.TypeChecker,
): boolean {
  if (pathSides(checker, checker.getTypeAtLocation(value))) return false;
  const call = value.parent;
  if (
    !ts.isCallExpression(call) ||
    call.arguments[0] !== value ||
    !ts.isPropertyAccessExpression(call.expression)
  )
    return false;
  const binding = checker.getSymbolAtLocation(call.expression.name);
  if (
    binding?.name !== "bind" ||
    !binding.declarations?.some((declaration) =>
      /\/typescript\/lib\/lib\./.test(
        declaration.getSourceFile().fileName.split("\\").join("/"),
      ),
    )
  )
    return false;
  const method = call.expression.expression;
  if (!ts.isPropertyAccessExpression(method)) return false;
  const declarations = checker.getSymbolAtLocation(method.name)?.declarations;
  return (
    Boolean(
      declarations?.some(
        (declaration) =>
          ts.isMethodDeclaration(declaration) &&
          ts.isClassDeclaration(declaration.parent) &&
          !checker.getSignatureFromDeclaration(declaration)?.thisParameter,
      ),
    ) &&
    checker.getTypeAtLocation(value) ===
      checker.getTypeAtLocation(method.expression)
  );
}

/** React tracks dependency identity without reading or converting stored paths. */
export function reactDependency(
  value: ts.Expression,
  checker: ts.TypeChecker,
): boolean {
  const argument = ts.isArrayLiteralExpression(value.parent)
    ? value.parent
    : value;
  const call = argument.parent;
  if (!ts.isCallExpression(call)) return false;
  const index = call.arguments.indexOf(argument as ts.Expression);
  const parameter = checker.getResolvedSignature(call)?.parameters[index];
  if (!parameter) return false;
  const type = checker.getTypeOfSymbolAtLocation(parameter, call);
  const parts = type.isUnion() ? type.types : [type];
  return parts.some((part) =>
    part.aliasSymbol?.declarations?.some(
      (declaration) =>
        part.aliasSymbol?.name === "DependencyList" &&
        declaration
          .getSourceFile()
          .fileName.split("\\")
          .join("/")
          .endsWith("/@types/react/index.d.ts"),
    ),
  );
}

/** Complete records serialize for hydration and snapshot equality, retaining all fields. */
export function serializedRecord(
  value: ts.Expression,
  checker: ts.TypeChecker,
): boolean {
  if (pathSides(checker, checker.getTypeAtLocation(value))) return false;
  const call = value.parent;
  if (!ts.isCallExpression(call) || call.arguments[0] !== value) return false;
  const declaration = checker.getResolvedSignature(call)?.declaration;
  if (
    !declaration ||
    !ts.isFunctionDeclaration(declaration) ||
    declaration.name?.text !== "canonicalJson"
  )
    return false;
  return /\/packages\/viewer\/(src|dist)\/components\/data\.(ts|d\.ts)$/.test(
    declaration.getSourceFile().fileName.split("\\").join("/"),
  );
}
