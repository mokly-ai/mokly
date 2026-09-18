import ts from "typescript";

const globals = [
  "window",
  "document",
  "Number",
  "String",
  "Object",
  "Array",
  "JSON",
  "Math",
];
const builtins = ["Math.min", "Math.max", "Array.isArray"];
export const inspectorPrivateProperties = /^__(?:list|scroll|keys|node|index)$/;

/** Pool repeated names as ordinary constants, preserving property names and receivers. */
export function inspectorPool(code) {
  const source = ts.createSourceFile(
    "inspector.js",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const counts = new Map();
  const references = new Set();
  const count = (word, saving) =>
    counts.set(word, (counts.get(word) ?? 0) + saving);
  const bindingName = (node) =>
    ts.isBindingElement(node) &&
    ts.isObjectBindingPattern(node.parent) &&
    !node.dotDotDotToken
      ? (node.propertyName ?? node.name)
      : undefined;
  const propertyWord = (node) =>
    node && (ts.isIdentifier(node) || ts.isStringLiteral(node))
      ? node.text
      : undefined;
  const binding = (node) =>
    node.parent.name === node &&
    (ts.isVariableDeclaration(node.parent) ||
      ts.isParameter(node.parent) ||
      ts.isBindingElement(node.parent) ||
      ts.isFunctionDeclaration(node.parent) ||
      ts.isFunctionExpression(node.parent) ||
      ts.isClassDeclaration(node.parent) ||
      ts.isClassExpression(node.parent));
  const collect = (node) => {
    if (ts.isIdentifier(node) && node.text.startsWith("__inspectorPool"))
      throw new Error("Reserved inspector minifier name");
    if (ts.isIdentifier(node) && globals.includes(node.text) && binding(node))
      throw new Error("Inspector minifier does not support native shadowing");
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      count(node.text, node.text.length + 1);
    if (ts.isPropertyAccessExpression(node))
      count(node.name.text, node.name.text.length - 2);
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name))
      count(node.name.text, node.name.text.length - 3);
    const word = propertyWord(bindingName(node));
    if (word) count(word, word.length - 3);
    if (ts.isShorthandPropertyAssignment(node))
      count(node.name.text, node.name.text.length - 3);
    if (
      ts.isIdentifier(node) &&
      globals.includes(node.text) &&
      !(
        ts.isPropertyAccessExpression(node.parent) &&
        (node.parent.name === node ||
          builtins.includes(node.parent.getText(source)))
      )
    )
      references.add(node.text);
    ts.forEachChild(node, collect);
  };
  collect(source);
  const words = [...counts]
    .filter(
      ([word, saving]) =>
        !inspectorPrivateProperties.test(word) && saving > word.length + 9,
    )
    .map(([word]) => word);
  const aliases = new Map(
    words.map((word, index) => [word, `__inspectorPoolWord${index}`]),
  );
  const natives = new Map(
    [...globals.filter((name) => references.has(name)), ...builtins].map(
      (word, index) => [word, `__inspectorPoolNative${index}`],
    ),
  );
  const identifier = (name) => ts.factory.createIdentifier(name);
  const property = (word) =>
    ts.factory.createComputedPropertyName(identifier(aliases.get(word)));
  const globalReference = (node) =>
    ts.isIdentifier(node) &&
    globals.includes(node.text) &&
    !(
      node.parent.name === node &&
      !ts.isShorthandPropertyAssignment(node.parent)
    );
  const result = ts.transform(source, [
    (context) => {
      const visit = (node) => {
        if (ts.isShorthandPropertyAssignment(node)) {
          const word = node.name.text;
          return ts.factory.createPropertyAssignment(
            aliases.has(word) ? property(word) : node.name,
            identifier(natives.get(word) ?? word),
          );
        }
        const word = propertyWord(bindingName(node));
        if (word && aliases.has(word))
          return ts.factory.updateBindingElement(
            node,
            node.dotDotDotToken,
            property(word),
            node.name,
            ts.visitNode(node.initializer, visit),
          );
        if (ts.isPropertyAssignment(node)) {
          const word = propertyWord(node.name);
          return ts.factory.updatePropertyAssignment(
            node,
            aliases.has(word) ? property(word) : node.name,
            ts.visitNode(node.initializer, visit),
          );
        }
        if (ts.isPropertyAccessExpression(node)) {
          const native = natives.get(node.getText(source));
          if (native) return identifier(native);
          if (aliases.has(node.name.text)) {
            const receiver = ts.visitNode(node.expression, visit),
              key = identifier(aliases.get(node.name.text));
            return ts.isPropertyAccessChain(node)
              ? ts.factory.createElementAccessChain(
                  receiver,
                  node.questionDotToken,
                  key,
                )
              : ts.factory.createElementAccessExpression(receiver, key);
          }
          const receiver = ts.visitNode(node.expression, visit);
          return ts.isPropertyAccessChain(node)
            ? ts.factory.updatePropertyAccessChain(
                node,
                receiver,
                node.questionDotToken,
                node.name,
              )
            : ts.factory.updatePropertyAccessExpression(
                node,
                receiver,
                node.name,
              );
        }
        if (globalReference(node)) return identifier(natives.get(node.text));
        if (
          (ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node)) &&
          aliases.has(node.text) &&
          !(ts.isExpressionStatement(node.parent) || node.parent.name === node)
        )
          return identifier(aliases.get(node.text));
        return ts.visitEachChild(node, visit, context);
      };
      return (root) => ts.visitNode(root, visit);
    },
  ]);
  const transformed = result.transformed[0];
  let directiveCount = 0;
  while (
    directiveCount < transformed.statements.length &&
    ts.isExpressionStatement(transformed.statements[directiveCount]) &&
    ts.isStringLiteral(transformed.statements[directiveCount].expression)
  )
    directiveCount++;
  const printer = ts.createPrinter();
  const directives = transformed.statements
    .slice(0, directiveCount)
    .map((node) =>
      printer.printNode(ts.EmitHint.Unspecified, node, transformed),
    )
    .join("\n");
  const body = printer.printFile(
    ts.factory.updateSourceFile(
      transformed,
      transformed.statements.slice(directiveCount),
    ),
  );
  result.dispose();
  const declarations = [...natives]
    .map(([word, name]) => `${name}=${word}`)
    .join(",");
  const delimiter = [
    "|",
    ...Array.from({ length: 32 }, (_, index) => String.fromCharCode(index)),
  ].find((candidate) => words.every((word) => !word.includes(candidate)));
  if (delimiter === undefined)
    throw new Error("No safe inspector string delimiter");
  return `((${[...aliases.values()].join(",")})=>{${directives}const ${declarations};${body}})(...${JSON.stringify(words.join(delimiter))}.split(${JSON.stringify(delimiter)}));`;
}
