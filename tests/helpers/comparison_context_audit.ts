import path from "node:path";

import ts from "typescript";

/** Inspect inferred object shapes, including shorthand fields and spreads. */
export function comparisonContextAudit(program: ts.Program, directory: string) {
  const checker = program.getTypeChecker();
  const failures: string[] = [];
  let contexts = 0;
  for (const source of program.getSourceFiles()) {
    const relative = path.relative(directory, source.fileName);
    if (
      source.isDeclarationFile ||
      relative.startsWith("..") ||
      path.isAbsolute(relative)
    )
      continue;
    const visit = (node: ts.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        const type = checker.getTypeAtLocation(node);
        const required = [
          "componentAware",
          "beforeReader",
          "afterReader",
          "resources",
        ];
        if (required.every((name) => type.getProperty(name))) {
          contexts++;
          const aware = node.properties.find(
            (property) =>
              ts.isPropertyAssignment(property) &&
              property.name.getText(source) === "componentAware",
          );
          const disabled =
            aware &&
            ts.isPropertyAssignment(aware) &&
            aware.initializer.kind === ts.SyntaxKind.FalseKeyword;
          const field = (name: string) => {
            const symbol = type.getProperty(name);
            return symbol && checker.getTypeOfSymbolAtLocation(symbol, node);
          };
          const oracle = field("comparisonOracle");
          const links = field("links");
          const marked =
            oracle?.isStringLiteral() && oracle.value === "page_m6";
          const callable =
            links &&
            checker.getSignaturesOfType(
              checker.getNonNullableType(links),
              ts.SignatureKind.Call,
            ).length > 0;
          if (!disabled && !marked && !callable) {
            const { line } = source.getLineAndCharacterOfPosition(
              node.getStart(source),
            );
            failures.push(
              `${relative}:${line + 1}: component-aware comparison context requires links or comparisonOracle: "page_m6"`,
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { contexts, failures };
}

/** Isolated typed snippets make the audit's own coverage executable. */
export function auditContextSource(source: string) {
  const file = path.resolve(".context/comparison-context-model.ts");
  const options: ts.CompilerOptions = {
    noLib: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
  };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name, languageVersion) =>
    name === file
      ? ts.createSourceFile(name, source, languageVersion, true)
      : undefined;
  host.fileExists = (name) => name === file;
  host.readFile = (name) => (name === file ? source : undefined);
  return comparisonContextAudit(
    ts.createProgram([file], options, host),
    path.dirname(file),
  );
}
