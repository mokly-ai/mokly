import { parse } from "@babel/parser";

/** Module namespace keys are sorted by JavaScript; source order needs the AST. */
export function orderedExports(
  source: string,
  values: Record<string, unknown>,
  module: string,
): [string, unknown][] {
  const ast = parse(source, {
    sourceType: "unambiguous",
    plugins: /\.[cm]?ts$/.test(module) ? ["typescript"] : ["typescript", "jsx"],
  });
  const names: string[] = [];
  for (const node of ast.program.body) {
    if (node.type === "ExportDefaultDeclaration") names.push("default");
    if (node.type !== "ExportNamedDeclaration") continue;
    for (const item of node.specifiers)
      names.push(
        item.exported.type === "Identifier"
          ? item.exported.name
          : item.exported.value,
      );
    const declaration = node.declaration;
    if (declaration?.type === "VariableDeclaration") {
      for (const item of declaration.declarations)
        if (item.id.type === "Identifier") names.push(item.id.name);
    } else if (
      declaration &&
      "id" in declaration &&
      declaration.id?.type === "Identifier"
    )
      names.push(declaration.id.name);
  }
  for (const name of Object.keys(values))
    if (!names.includes(name)) names.push(name);
  return names
    .filter((name) => Object.hasOwn(values, name))
    .map((name) => [name, values[name]]);
}
