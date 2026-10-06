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
  if (
    pathSides(checker, from) & CURRENT &&
    to.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)
  )
    return true;
  if (from.isUnion())
    return from.types.some((part) =>
      erasesReference(checker, part, to, depth + 1),
    );
  if (to.isUnion()) {
    const compatible = to.types.filter((part) =>
      checker.isTypeAssignableTo(from, part),
    );
    return (compatible.length ? compatible : to.types).every((part) =>
      erasesReference(checker, from, part, depth + 1),
    );
  }
  const sourceIndex = checker.getIndexTypeOfType(from, ts.IndexKind.Number);
  const targetIndex = checker.getIndexTypeOfType(to, ts.IndexKind.Number);
  const erasedObject = Boolean(
    to.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown),
  );
  if (
    from.flags & ts.TypeFlags.Object &&
    (from as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
  ) {
    const source = from as ts.TypeReference;
    const target =
      to.flags & ts.TypeFlags.Object &&
      (to as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
        ? (to as ts.TypeReference)
        : undefined;
    const collection = source.target.symbol?.declarations?.some(
      (declaration) =>
        /\/typescript\/lib\/lib\./.test(
          declaration.getSourceFile().fileName.split("\\").join("/"),
        ) &&
        [
          "Map",
          "ReadonlyMap",
          "Set",
          "ReadonlySet",
          "Promise",
          "PromiseLike",
        ].includes(source.target.symbol.name),
    );
    if (collection && (erasedObject || target?.target === source.target)) {
      const targets = target ? checker.getTypeArguments(target) : [];
      if (
        checker
          .getTypeArguments(source)
          .some((argument, index) =>
            erasesReference(checker, argument, targets[index] ?? to, depth + 1),
          )
      )
        return true;
    }
  }
  if (
    sourceIndex &&
    (targetIndex || erasedObject) &&
    erasesReference(checker, sourceIndex, targetIndex ?? to, depth + 1)
  )
    return true;
  for (const source of checker.getPropertiesOfType(from)) {
    const target = checker.getPropertyOfType(to, source.name);
    if (
      source &&
      (target || erasedObject) &&
      erasesReference(
        checker,
        checker.getTypeOfSymbol(source),
        target ? checker.getTypeOfSymbol(target) : to,
        depth + 1,
      )
    )
      return true;
  }
  return false;
}
