import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

import { repositoryRoot } from "./helpers/fixture.js";

test("ordinary preview fixture imports and exports every example screen component", async () => {
  const [catalogueSource, helperSource] = await Promise.all(
    [
      "examples/basic/entries/catalogue.mockup.tsx",
      "tests/helpers/example_baseline.ts",
    ].map((file) => fs.readFile(path.join(repositoryRoot, file), "utf8")),
  );
  const template = variableValue(
    parse(helperSource!),
    "ordinaryPreviewFixtureSource",
  );
  assert.ok(template && ts.isNoSubstitutionTemplateLiteral(template));
  const fixture = parse(template.text);
  const required = componentImports(parse(catalogueSource!));
  const available = componentImports(fixture);
  const mockups = variableValue(fixture, "mockups");
  assert.ok(mockups && ts.isArrayLiteralExpression(mockups));
  assert.ok(required.size > 0);
  for (const [module, bindings] of required) {
    const imported = available.get(module);
    assert.ok(imported, `ordinary preview omits component module ${module}`);
    for (const exported of bindings.keys()) {
      const local = imported.get(exported);
      assert.ok(local, `ordinary preview omits ${exported} from ${module}`);
      assert.ok(
        mockups.elements.some(
          (entry) =>
            ts.isPropertyAccessExpression(entry) &&
            ts.isIdentifier(entry.expression) &&
            entry.expression.text === local &&
            entry.name.text === "entries",
        ),
        `ordinary preview registry omits ${local}.entries`,
      );
    }
  }
});

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile(
    "fixture.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function variableValue(
  file: ts.SourceFile,
  name: string,
): ts.Expression | undefined {
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name)
        return declaration.initializer;
  }
  return undefined;
}

function componentImports(
  file: ts.SourceFile,
): Map<string, Map<string, string>> {
  const imports = new Map<string, Map<string, string>>();
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const module = statement.moduleSpecifier.text;
    if (!/^\.\.\/src\/components\/.*\.mokly\.js$/u.test(module)) continue;
    const bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings));
    imports.set(
      module,
      new Map(
        bindings.elements.map((binding) => [
          binding.propertyName?.text ?? binding.name.text,
          binding.name.text,
        ]),
      ),
    );
  }
  return imports;
}
