import ts from "typescript";

const CURRENT = 1;
const BEFORE = 2;

/** Read nominal path sides through unions, intersections and type parameters. */
export function pathSides(checker: ts.TypeChecker, type: ts.Type): number {
  if (type.isUnion())
    return type.types.reduce(
      (bits, part) => bits | pathSides(checker, part),
      0,
    );
  if (type.flags & ts.TypeFlags.TypeParameter) {
    const constraint = checker.getBaseConstraintOfType(type);
    return constraint ? pathSides(checker, constraint) : 0;
  }
  const property = checker.getPropertyOfType(type, "__moklyPathSide");
  if (!property) return 0;
  const side = checker.getTypeOfSymbol(property);
  if (!side.isStringLiteral()) return 0;
  return side.value === "current"
    ? CURRENT
    : side.value === "branch-point"
      ? BEFORE
      : 0;
}

/** A cast or typed assignment must retain every shared reference field. */
export function erasesReference(
  checker: ts.TypeChecker,
  from: ts.Type,
  to: ts.Type,
  depth = 0,
): boolean {
  if (depth > 8 || from === to) return false;
  if (pathSides(checker, from) & BEFORE)
    return !(pathSides(checker, to) & BEFORE);
  if (from.isUnion())
    return from.types.some((part) =>
      erasesReference(checker, part, to, depth + 1),
    );
  if (to.isUnion())
    return to.types.every((part) =>
      erasesReference(checker, from, part, depth + 1),
    );
  const sourceIndex = checker.getIndexTypeOfType(from, ts.IndexKind.Number);
  const targetIndex = checker.getIndexTypeOfType(to, ts.IndexKind.Number);
  if (
    sourceIndex &&
    targetIndex &&
    erasesReference(checker, sourceIndex, targetIndex, depth + 1)
  )
    return true;
  for (const name of [
    "path",
    "variantOf",
    "previousPath",
    "componentId",
    "entry",
    "context",
    "via",
    "instances",
    "usage",
    "views",
    "componentViews",
    "evidence",
    "steps",
    "screenPath",
    "useCasePaths",
  ]) {
    const source = checker.getPropertyOfType(from, name);
    const target = checker.getPropertyOfType(to, name);
    if (
      source &&
      target &&
      erasesReference(
        checker,
        checker.getTypeOfSymbol(source),
        checker.getTypeOfSymbol(target),
        depth + 1,
      )
    )
      return true;
  }
  return false;
}
