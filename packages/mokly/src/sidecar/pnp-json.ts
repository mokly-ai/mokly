import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

import { jsonObject } from "./config-json.js";
import { PackageJson, parsePackageJson } from "./package-json.js";

const traverse = traverseModule.default;
const fields = ["packageRegistryData", "fallbackPool"];

function literalString(value: unknown): string | undefined {
  if (!jsonObject(value)) return undefined;
  if (value.type === "StringLiteral" && typeof value.value === "string")
    return value.value;
  if (value.type === "BinaryExpression" && value.operator === "+") {
    const left = literalString(value.left);
    const right = literalString(value.right);
    return left !== undefined && right !== undefined ? left + right : undefined;
  }
  if (
    value.type === "TemplateLiteral" &&
    Array.isArray(value.expressions) &&
    value.expressions.length === 0 &&
    Array.isArray(value.quasis)
  ) {
    const quasi: unknown = value.quasis[0];
    if (
      jsonObject(quasi) &&
      jsonObject(quasi.value) &&
      typeof quasi.value.cooked === "string"
    )
      return quasi.value.cooked;
  }
  return undefined;
}

function literalJson(node: unknown): unknown {
  if (!jsonObject(node)) throw new Error("unsupported PnP literal");
  if (
    ["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(
      String(node.type),
    )
  )
    return node.value;
  if (node.type === "NullLiteral") return null;
  if (node.type === "ArrayExpression" && Array.isArray(node.elements))
    return node.elements.map(literalJson);
  if (node.type === "ObjectExpression" && Array.isArray(node.properties)) {
    const entries: Array<[string, unknown]> = [];
    for (const property of node.properties) {
      if (
        !jsonObject(property) ||
        property.type !== "ObjectProperty" ||
        property.computed ||
        !jsonObject(property.key)
      )
        throw new Error("unsupported PnP property");
      const key: unknown =
        property.key.type === "Identifier"
          ? property.key.name
          : property.key.value;
      if (typeof key !== "string") throw new Error("unsupported PnP key");
      entries.push([key, literalJson(property.value)]);
    }
    return new PackageJson(entries);
  }
  throw new Error("unsupported PnP literal");
}

/** Read the native PnP data forms without executing the manifest's JavaScript. */
export function pnpJson(file: string, text: string): PackageJson | undefined {
  if (file.endsWith(".json")) return parsePackageJson(text, fields);
  let data: PackageJson | undefined;
  const ast = parse(text, { sourceType: "unambiguous" });
  traverse(ast, {
    CallExpression: {
      exit(call) {
        const node = call.node;
        if (
          node.callee.type !== "Identifier" ||
          node.callee.name !== "hydrateRuntimeState"
        )
          return;
        let argument = node.arguments[0];
        let json: string | undefined;
        if (argument?.type === "ObjectExpression") {
          const literal = literalJson(argument);
          if (literal instanceof PackageJson) data = literal;
        } else if (
          argument?.type === "CallExpression" &&
          argument.arguments.length === 1
        ) {
          const callee = argument.callee;
          if (
            callee.type !== "MemberExpression" ||
            callee.computed ||
            callee.object.type !== "Identifier" ||
            callee.object.name !== "JSON" ||
            callee.property.type !== "Identifier" ||
            callee.property.name !== "parse" ||
            call.scope.getBinding("JSON")
          )
            return;
          argument = argument.arguments[0];
          if (argument?.type === "Identifier") {
            const declaration = call.scope.getBinding(argument.name)?.path.node;
            if (declaration?.type === "VariableDeclarator")
              argument = declaration.init ?? undefined;
          }
          json = literalString(argument);
        }
        if (json !== undefined) data = parsePackageJson(json, fields);
      },
    },
  });
  return data;
}
