import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default;
type Expression = {
  type?: string;
  value?: unknown;
  operator?: string;
  left?: unknown;
  expressions?: unknown[];
  quasis?: { value: { cooked?: string | null } }[];
};

function prefix(value: unknown): string | undefined {
  const node = value as Expression | undefined;
  if (node?.type === "StringLiteral" && typeof node.value === "string")
    return node.value;
  if (node?.type === "TemplateLiteral")
    return node.quasis?.[0]?.value.cooked ?? undefined;
  if (node?.type === "BinaryExpression" && node.operator === "+")
    return prefix(node.left);
}

function analyzable(value: unknown): boolean {
  const node = value as Expression | undefined;
  return (
    node?.type === "StringLiteral" ||
    (node?.type === "TemplateLiteral" && !node.expressions?.length) ||
    /^\.\.?\//.test(prefix(value) ?? "")
  );
}

/** Keep dynamic require and import rooted at each local source's real location. */
export function moduleContext(
  source: string,
  file: string,
  root = false,
): string {
  const ast = parse(source, {
    sourceType: "unambiguous",
    createImportExpressions: true,
    allowReturnOutsideFunction: true,
  });
  const replacements = new Map<number, { end: number; text: string }>();
  let binding = "";
  let factory = "";
  traverse(ast, {
    Program(program) {
      binding = program.scope.generateUidIdentifier("moklyContext").name;
      factory = program.scope.generateUidIdentifier("moklyContextFactory").name;
      program.traverse({
        ReferencedIdentifier(reference) {
          if (
            reference.node.name !== "require" ||
            reference.scope.hasBinding("require")
          )
            return;
          const parent = reference.parent;
          if (
            !root &&
            parent.type === "CallExpression" &&
            parent.callee === reference.node &&
            analyzable(parent.arguments[0])
          )
            return;
          const start = reference.node.start!;
          const shorthand =
            parent.type === "ObjectProperty" && parent.shorthand;
          replacements.set(start, {
            end: reference.node.end!,
            text: `${shorthand ? "require: " : ""}${binding}.require`,
          });
        },
        ImportExpression(expression) {
          if (root || analyzable(expression.node.source)) return;
          replacements.set(expression.node.start!, {
            end: expression.node.source.start!,
            text: `${binding}.import(`,
          });
        },
      });
      program.stop();
    },
  });
  if (!replacements.size) return source;
  const at = Math.max(
    ast.program.interpreter ? ast.program.interpreter.end! + 1 : 0,
    ast.program.directives.at(-1)?.end ?? 0,
  );
  for (const [start, replacement] of [...replacements].sort(
    ([a], [b]) => b - a,
  ))
    source =
      source.slice(0, start) + replacement.text + source.slice(replacement.end);
  const initializer = root
    ? `\nimport { context as ${factory} } from ${JSON.stringify(new URL("./postcss-resolution.js", import.meta.url).href)}; const ${binding} = ${factory}(${JSON.stringify(file)});\n`
    : `\nconst ${binding} = require("mokly:postcss-context").context(${JSON.stringify(file)});\n`;
  return source.slice(0, at) + initializer + source.slice(at);
}
