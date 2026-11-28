import { parse } from "@babel/parser";
import type { Program } from "@babel/types";

import type { ModulePaths } from "./module-paths.js";
import { StoryBodyEdits } from "./story-body-edits.js";
import {
  componentLiteral,
  instrumentClass,
  instrumentFunction,
} from "./story-body-functions.js";

export function storyBodySource(file: string): boolean {
  return /\.(?:[cm]?[jt]s|[jt]sx)$/u.test(file) && !/\.d\.[cm]?ts$/u.test(file);
}

export function transformEsbuildStoryBodies(
  bytes: Uint8Array,
  file: string,
  loader: string,
  paths: ModulePaths,
): string | undefined {
  if (
    !paths.repositoryOwned(file) ||
    !storyBodySource(file) ||
    !["js", "jsx", "ts", "tsx"].includes(loader)
  )
    return;
  return transformStoryBodies(
    Buffer.from(bytes).toString("utf8"),
    file,
    loader.startsWith("ts"),
    loader.endsWith("x"),
  );
}

const componentName = (name: string) => /^[A-Z]/u.test(name);

function exportedComponents({ body }: Program): Set<string> {
  const names = new Set<string>();
  for (const node of body) {
    if (node.type === "ExportDefaultDeclaration") {
      if (node.declaration.type === "Identifier")
        names.add(node.declaration.name);
      else if (
        (node.declaration.type === "FunctionDeclaration" ||
          node.declaration.type === "ClassDeclaration") &&
        node.declaration.id
      )
        names.add(node.declaration.id.name);
    }
    if (
      node.type !== "ExportNamedDeclaration" ||
      node.source ||
      node.exportKind === "type"
    )
      continue;
    for (const specifier of node.specifiers) {
      if (
        specifier.type !== "ExportSpecifier" ||
        specifier.exportKind === "type"
      )
        continue;
      const name =
        specifier.exported.type === "Identifier"
          ? specifier.exported.name
          : specifier.exported.value;
      if (name === "default" || componentName(name))
        names.add(specifier.local.name);
    }
  }
  return names;
}

/** Compile definition-site hooks while leaving the original component bindings in place. */
export function transformStoryBodies(
  source: string,
  file: string,
  typescript = /\.[cm]?tsx?$/u.test(file),
  jsx = !/\.[cm]?ts$/u.test(file),
): string | undefined {
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(source, {
      sourceType: "unambiguous",
      tokens: true,
      plugins: [
        "decorators-legacy",
        "deprecatedImportAssert",
        ...(typescript ? (["typescript"] as const) : []),
        ...(jsx ? (["jsx"] as const) : []),
      ],
    });
  } catch {
    // The selected compiler remains responsible for the module's syntax.
    return;
  }
  const { program } = ast;
  const names = exportedComponents(program);
  const include = (name: string) => componentName(name) || names.has(name);
  const unique = (base: string) => {
    let name = base;
    while (source.includes(name)) name += "_";
    return name;
  };
  const helper = unique("__moklyStory");
  const locations = unique("__moklySites");
  const defaultName = unique("__moklyDefault");
  const edits = new StoryBodyEdits(source, ast.tokens ?? []);
  const declarations: string[] = [];
  const mark = (name: string, display?: string) =>
    `;${helper}.mark(${name}${display ? `,${JSON.stringify(display)}` : ""});`;

  for (const statement of program.body) {
    const defaultExport = statement.type === "ExportDefaultDeclaration";
    const node =
      defaultExport || statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (!node || ("declare" in node && node.declare)) continue;
    if (node.type === "FunctionDeclaration" && !node.generator) {
      const name = node.id?.name ?? defaultName;
      if (!defaultExport && !include(name)) continue;
      if (!node.id)
        edits.insert(
          edits.token("function", node.start!, node.body.start!).end,
          ` ${name}`,
        );
      instrumentFunction(edits, node, name, helper);
      declarations.push(mark(name, node.id ? undefined : "default"));
    } else if (node.type === "ClassDeclaration") {
      const name = node.id?.name ?? defaultName;
      if (!defaultExport && !include(name)) continue;
      if (!instrumentClass(edits, node, name, helper)) continue;
      if (!node.id)
        edits.insert(
          edits.token("class", node.start!, node.body.start!).end,
          ` ${name}`,
        );
      edits.insert(statement.end!, mark(name, node.id ? undefined : "default"));
    } else if (node.type === "VariableDeclaration") {
      for (const { id, init } of node.declarations) {
        if (id.type !== "Identifier" || !init || !include(id.name)) continue;
        const literal = componentLiteral(init);
        if (literal && !literal.generator) {
          instrumentFunction(edits, literal, id.name, helper);
          edits.insert(statement.end!, mark(id.name));
        } else if (init.type === "ClassExpression") {
          if (instrumentClass(edits, init, id.name, helper))
            edits.insert(statement.end!, mark(id.name));
        } else if (
          node.kind === "const" &&
          (init.type === "CallExpression" ||
            init.type === "TaggedTemplateExpression")
        ) {
          edits.insert(init.start!, `${helper}.binding(`);
          edits.insert(init.end!, ")");
        }
      }
    } else if (
      defaultExport &&
      (node.type === "ArrowFunctionExpression" ||
        node.type === "FunctionExpression" ||
        node.type === "CallExpression")
    ) {
      const literal = componentLiteral(node);
      const keyword = edits.token("default", statement.start!, node.start!);
      edits.replace(
        statement.start!,
        statement.start! + "export".length,
        `const ${defaultName}`,
      );
      edits.replace(keyword.start, keyword.end, "=");
      if (literal && !literal.generator) {
        instrumentFunction(edits, literal, defaultName, helper);
        edits.insert(statement.end!, mark(defaultName, "default"));
      } else if (node.type === "CallExpression") {
        edits.insert(node.start!, `${helper}.binding(`);
        edits.insert(node.end!, ")");
      }
      edits.insert(statement.end!, `;export default ${defaultName};`);
    }
  }
  if (!edits.changed) return;
  const afterShebang = program.interpreter
    ? source.indexOf("\n", program.interpreter.end!) + 1
    : 0;
  const start = program.directives.at(-1)?.end ?? afterShebang;
  const commonjs = program.sourceType === "script";
  const runtime = "react/jsx-dev-runtime";
  const requireHelper = commonjs
    ? `const ${helper}=require("${runtime}").moklyStory;`
    : "";
  edits.insert(
    start,
    `;${requireHelper}${helper}.sites(${JSON.stringify(file)},${locations}());${declarations.join("")}`,
  );
  const { code, sites } = edits.finish();
  const importHelper = commonjs
    ? ""
    : `import {moklyStory as ${helper}} from "${runtime}";\n`;
  return `${code}\n${importHelper}function ${locations}(){return ${JSON.stringify(sites)};}\n`;
}
