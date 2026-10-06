import ts from "typescript";

/** One browser spec's path and authored TypeScript source. */
export interface BrowserSpecSource {
  readonly path: string;
  readonly source: string;
}

/** A browser test layer violation, with its rule and owning file. */
export interface DesignBoundaryIssue {
  readonly path: string;
  readonly rule: "design-runtime" | "runtime-artboard";
}

const runtimeImport =
  /(?:\/export\/|\/server\/|preview.*fixture|static_server|runtime_fixture)/u;
const runtimeCall =
  /^(?:exportCatalogue|buildPreview|servePreviewFixture|startCatalogueServer|start.*Server|create.*Preview.*Fixture)$/u;

/** Inspect source text without reading files or starting any runtime. */
export function designBoundaryIssues(
  specs: readonly BrowserSpecSource[],
): DesignBoundaryIssue[] {
  return specs.flatMap(({ path: file, source }): DesignBoundaryIssue[] => {
    const inDesign = file
      .replaceAll("\\", "/")
      .startsWith("tests/browser/design/");
    const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    let importsArtboard = false;
    let usesRuntime = false;
    const forbiddenCalls = new Set<string>();

    for (const statement of tree.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const binding of bindings.elements) {
          const original = binding.propertyName?.text ?? binding.name.text;
          if (original === "designArtboardUrl") importsArtboard = true;
          if (runtimeCall.test(original)) forbiddenCalls.add(binding.name.text);
        }
      if (runtimeImport.test(statement.moduleSpecifier.text))
        usesRuntime = true;
      if (
        /\/design\/artboards(?:\.[cm]?[jt]s)?$/u.test(
          statement.moduleSpecifier.text,
        )
      )
        importsArtboard = true;
    }

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : "";
        if (runtimeCall.test(name) || forbiddenCalls.has(name))
          usesRuntime = true;
        if (name === "goto") {
          const target = node.arguments[0]?.getText(tree) ?? "";
          if (/\/view\/|https?:\/\/|\$\{[^}]*\.url\}/u.test(target))
            usesRuntime = true;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);

    if (inDesign && usesRuntime)
      return [{ path: file, rule: "design-runtime" as const }];
    if (
      !inDesign &&
      (importsArtboard || /generated[\\/]design(?:[\\/]|["'`])/u.test(source))
    )
      return [{ path: file, rule: "runtime-artboard" as const }];
    return [];
  });
}
