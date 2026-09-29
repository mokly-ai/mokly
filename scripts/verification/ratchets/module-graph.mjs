import ts from "typescript";

import { addCommonJsExportNames } from "./module-commonjs.mjs";
import {
  createModuleResolver,
  normalizeModulePath,
} from "./module-resolution.mjs";
import {
  dynamicImportRecords,
  hasModifier,
  scriptKind,
  stringSpecifier,
} from "./module-syntax.mjs";

/** Discover runtime named exports unused by any distinct workspace module. */
export function discoverUnusedInternalExports({
  modules,
  publicEntrypoints,
  aliases = {},
}) {
  const records = new Map(
    modules.map((module) => {
      const normalized = normalizeModulePath(module.path);
      return [normalized, parseModule({ ...module, path: normalized })];
    }),
  );
  const resolve = createModuleResolver(records, aliases);
  const available = availableExports(records, resolve);
  const used = importedExports(records, available, resolve);
  const publicExports = exposedExports(
    records,
    available,
    resolve,
    publicEntrypoints.map(normalizeModulePath),
  );
  const unused = [];
  for (const record of records.values()) {
    if (!record.candidate) continue;
    for (const name of available.get(record.path) ?? []) {
      const key = exportKey(record.path, name);
      if (!used.has(key) && !publicExports.has(key)) unused.push(key);
    }
  }
  return unused.sort();
}

function parseModule(module) {
  const source = ts.createSourceFile(
    module.path,
    module.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(module.path),
  );
  const record = {
    path: module.path,
    candidate: module.candidate ?? true,
    direct: new Set(),
    imports: [],
    reexports: [],
    exportAll: [],
  };
  const bindings = importBindings(source, record);
  const values = topLevelValues(source);
  addCommonJsExportNames(source, record.direct);
  for (const statement of source.statements) {
    if (isNamedValueExport(statement))
      addDeclarationNames(statement, record.direct);
    if (!ts.isExportDeclaration(statement)) continue;
    const specifier = stringSpecifier(statement.moduleSpecifier);
    if (statement.isTypeOnly) {
      recordTypeReexport(record, statement.exportClause, specifier);
      continue;
    }
    if (!statement.exportClause) {
      if (specifier) record.exportAll.push(specifier);
      continue;
    }
    if (ts.isNamespaceExport(statement.exportClause)) {
      record.direct.add(statement.exportClause.name.text);
      if (specifier)
        record.reexports.push({
          exported: statement.exportClause.name.text,
          specifier,
          namespace: true,
        });
      continue;
    }
    for (const element of statement.exportClause.elements) {
      if (element.isTypeOnly) {
        if (specifier)
          record.imports.push({
            specifier,
            names: [(element.propertyName ?? element.name).text],
          });
        continue;
      }
      const exported = element.name.text;
      if (exported === "default") continue;
      const imported = (element.propertyName ?? element.name).text;
      if (specifier) {
        record.reexports.push({ exported, imported, specifier });
        continue;
      }
      const binding = bindings.get(imported);
      if (binding) {
        record.reexports.push({ exported, ...binding });
      } else if (values.has(imported)) {
        record.direct.add(exported);
      }
    }
  }
  record.imports.push(...dynamicImportRecords(source));
  return record;
}

function recordTypeReexport(record, clause, specifier) {
  if (!specifier) return;
  if (!clause || ts.isNamespaceExport(clause)) {
    record.imports.push({ specifier, namespace: true });
    return;
  }
  record.imports.push({
    specifier,
    names: clause.elements.map(
      (element) => (element.propertyName ?? element.name).text,
    ),
  });
}

function importBindings(source, record) {
  const bindings = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = stringSpecifier(statement.moduleSpecifier);
    if (!specifier || !statement.importClause) continue;
    const clause = statement.importClause;
    if (clause.name)
      bindings.set(clause.name.text, { imported: "default", specifier });
    const named = clause.namedBindings;
    if (named && ts.isNamespaceImport(named)) {
      bindings.set(named.name.text, { namespace: true, specifier });
      record.imports.push({ specifier, namespace: true });
    } else if (named) {
      const names = [];
      for (const element of named.elements) {
        const imported = (element.propertyName ?? element.name).text;
        names.push(imported);
        bindings.set(element.name.text, { imported, specifier });
      }
      record.imports.push({ specifier, names });
    }
  }
  return bindings;
}

function topLevelValues(source) {
  const values = new Set();
  for (const statement of source.statements) {
    if (hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) continue;
    addDeclarationNames(statement, values);
  }
  return values;
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
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)) &&
    statement.name &&
    ts.isIdentifier(statement.name)
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

function isNamedValueExport(statement) {
  return (
    hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
    !hasModifier(statement, ts.SyntaxKind.DefaultKeyword) &&
    !hasModifier(statement, ts.SyntaxKind.DeclareKeyword) &&
    (ts.isVariableStatement(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement))
  );
}

function availableExports(records, resolve) {
  const available = new Map(
    [...records].map(([file, record]) => [file, new Set(record.direct)]),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records.values()) {
      const names = available.get(record.path);
      for (const item of record.reexports) {
        if (!names.has(item.exported)) {
          names.add(item.exported);
          changed = true;
        }
      }
      for (const specifier of record.exportAll) {
        const target = resolve(record.path, specifier);
        for (const name of available.get(target) ?? []) {
          if (names.has(name)) continue;
          names.add(name);
          changed = true;
        }
      }
    }
  }
  return available;
}

function importedExports(records, available, resolve) {
  const used = new Set();
  for (const record of records.values()) {
    for (const item of [...record.imports, ...record.reexports]) {
      const target = resolve(record.path, item.specifier);
      if (!target || target === record.path) continue;
      if (item.namespace) addAll(used, target, available.get(target));
      else
        for (const name of item.names ?? [item.imported])
          if (name && name !== "default") used.add(exportKey(target, name));
    }
    for (const specifier of record.exportAll) {
      const target = resolve(record.path, specifier);
      if (target && target !== record.path)
        addAll(used, target, available.get(target));
    }
  }
  return used;
}

function exposedExports(records, available, resolve, entrypoints) {
  const exposed = new Set();
  const queue = [];
  for (const entrypoint of entrypoints)
    for (const name of available.get(entrypoint) ?? [])
      queue.push([entrypoint, name]);
  for (let index = 0; index < queue.length; index += 1) {
    const [file, name] = queue[index];
    const key = exportKey(file, name);
    if (exposed.has(key)) continue;
    exposed.add(key);
    const record = records.get(file);
    if (!record) continue;
    for (const item of record.reexports.filter(
      (item) => item.exported === name,
    )) {
      const target = resolve(file, item.specifier);
      if (!target) continue;
      if (item.namespace)
        for (const targetName of available.get(target) ?? [])
          queue.push([target, targetName]);
      else if (item.imported && item.imported !== "default")
        queue.push([target, item.imported]);
    }
    for (const specifier of record.exportAll) {
      const target = resolve(file, specifier);
      if (target && available.get(target)?.has(name))
        queue.push([target, name]);
    }
  }
  return exposed;
}

function addAll(target, file, names = []) {
  for (const name of names) target.add(exportKey(file, name));
}

function exportKey(file, name) {
  return `${file}#${name}`;
}
