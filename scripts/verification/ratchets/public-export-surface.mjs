import ts from "typescript";

import { resolveRelativeModule } from "./module-resolution.mjs";
import { hasModifier, scriptKind, stringSpecifier } from "./module-syntax.mjs";

/** Expand the public names reachable from one source entry point. */
export function expandedPublicExports({ entrypoint, fileExists, readFile }) {
  const findings = [];
  const records = new Map();
  const visit = (file) => {
    if (records.has(file)) return;
    const parsed = parsePublicModule(file, readFile(file));
    const record = { direct: new Set(parsed.names), stars: [] };
    records.set(file, record);
    for (const specifier of parsed.stars) {
      const target = resolveRelativeModule(file, specifier, fileExists);
      if (!target) {
        findings.push(
          `${file} star re-export ${JSON.stringify(specifier)} cannot resolve to a source module`,
        );
        continue;
      }
      record.stars.push(target);
      visit(target);
    }
  };
  visit(entrypoint);
  const available = new Map(
    [...records].map(([file, record]) => [file, new Set(record.direct)]),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const [file, record] of records) {
      const names = available.get(file);
      for (const target of record.stars) {
        for (const name of available.get(target) ?? []) {
          if (name === "default" || names.has(name)) continue;
          names.add(name);
          changed = true;
        }
      }
    }
  }
  return {
    findings,
    names: [...(available.get(entrypoint) ?? [])].sort(),
  };
}

function parsePublicModule(file, source) {
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );
  const names = new Set();
  const stars = [];
  for (const statement of syntax.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) {
        stars.push(stringSpecifier(statement.moduleSpecifier));
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        names.add(statement.exportClause.name.text);
      } else {
        for (const element of statement.exportClause.elements)
          names.add(element.name.text);
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      if (!statement.isExportEquals) names.add("default");
      continue;
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      names.add("default");
      continue;
    }
    addDeclarationNames(statement, names);
  }
  return { names: [...names].sort(), stars };
}

function addDeclarationNames(statement, names) {
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations)
      addBindingNames(declaration.name, names);
    return;
  }
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)) &&
    statement.name
  )
    names.add(statement.name.text);
}

function addBindingNames(binding, names) {
  if (ts.isIdentifier(binding)) {
    names.add(binding.text);
    return;
  }
  for (const element of binding.elements) {
    if (ts.isBindingElement(element)) addBindingNames(element.name, names);
  }
}
