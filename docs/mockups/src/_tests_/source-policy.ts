import ts from "typescript";

export interface SourceFile {
  path: string;
  text: string;
}

/** An expression without the `as`, `satisfies` and parentheses around it. */
function bare(node: ts.Expression): ts.Expression {
  return ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
    ? bare(node.expression)
    : node;
}

/** Every JSX element, self-closing element and fragment beneath one node. */
function jsxBeneath(node: ts.Node): ts.Node[] {
  const found: ts.Node[] =
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node)
      ? [node]
      : [];
  node.forEachChild((child) => {
    found.push(...jsxBeneath(child));
  });
  return found;
}

/**
 * An owning entry draws one imported screen component through its one
 * render: the component itself, or the one that a module-level record of
 * imported screen components gives for the state. Its variants are listed in
 * the entry and share that render; flows never own JSX.
 */
export function screenCompositionViolations(file: SourceFile): string[] {
  const source = ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const screenImports = new Set<string>();
  const screenRecords = new Set<string>();
  const violations: string[] = [];
  for (const node of source.statements) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.includes("/screens/")
    ) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const binding of bindings.elements)
          screenImports.add(binding.name.text);
    }
  }
  for (const node of source.statements)
    if (ts.isVariableStatement(node))
      for (const { name, initializer } of node.declarationList.declarations) {
        const record = initializer && bare(initializer);
        if (
          ts.isIdentifier(name) &&
          record &&
          ts.isObjectLiteralExpression(record) &&
          record.properties.length > 0 &&
          record.properties.every(
            (entry) =>
              (ts.isPropertyAssignment(entry) &&
                ts.isIdentifier(entry.initializer) &&
                screenImports.has(entry.initializer.text)) ||
              (ts.isShorthandPropertyAssignment(entry) &&
                screenImports.has(entry.name.text)),
          )
        )
          screenRecords.add(name.text);
      }
  function property(input: ts.Expression | undefined, name: string) {
    return input && ts.isObjectLiteralExpression(input)
      ? input.properties.find(
          (candidate) =>
            candidate.name?.getText(source).replaceAll('"', "") === name,
        )
      : undefined;
  }
  /** Whether the render binds this name to an entry of a screen record. */
  function selectedScreen(render: ts.Node, name: string): boolean {
    let selected = false;
    const visitBinding = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name &&
        node.initializer &&
        ts.isElementAccessExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        screenRecords.has(node.initializer.expression.text)
      )
        selected = true;
      node.forEachChild(visitBinding);
    };
    visitBinding(render);
    return selected;
  }
  /** One render draws exactly one imported screen component and no markup. */
  function composition(input: ts.Expression | undefined) {
    const member = property(input, "render");
    const render =
      member && ts.isPropertyAssignment(member) ? member.initializer : member;
    if (
      !render ||
      !(
        ts.isArrowFunction(render) ||
        ts.isFunctionExpression(render) ||
        ts.isMethodDeclaration(render)
      )
    ) {
      violations.push(
        file.path + ": screen entry must render one imported screen component",
      );
      return;
    }
    const drawn = jsxBeneath(render);
    const [element] = drawn;
    if (
      drawn.length !== 1 ||
      element === undefined ||
      !ts.isJsxSelfClosingElement(element)
    ) {
      violations.push(
        file.path + ": screen entry must render one imported screen component",
      );
      return;
    }
    const name = element.tagName.getText(source);
    if (!screenImports.has(name) && !selectedScreen(render, name))
      violations.push(file.path + ": screen must be an imported component");
  }
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "defineScreen"
    ) {
      const input = node.arguments[0];
      composition(input);
      const variants = property(input, "variants");
      if (
        variants &&
        (!ts.isPropertyAssignment(variants) ||
          !ts.isArrayLiteralExpression(variants.initializer) ||
          !variants.initializer.elements.every(ts.isObjectLiteralExpression))
      )
        violations.push(file.path + ": variants must be listed in the entry");
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "defineUseCase"
    ) {
      function rejectJsx(child: ts.Node) {
        if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child))
          violations.push(file.path + ": flow cannot own screen markup");
        ts.forEachChild(child, rejectJsx);
      }
      node.arguments.forEach(rejectJsx);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return violations;
}

/** Repeated primitives need explicit instance keys for component attribution. */
export function repeatedComponentViolations(file: SourceFile): string[] {
  const source = ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const calls = new Map<
    string,
    (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[]
  >();
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(source);
      if (
        [
          "Avatar",
          "StatusDot",
          "Button",
          "Badge",
          "Card",
          "Input",
          "Header",
          "PageFrame",
          "CommentThread",
          "ReviewIllustration",
          "Textarea",
          "Segmented",
          "Switch",
          "OptionsList",
          "Selector",
          "ContentList",
          "Skeleton",
        ].includes(name)
      ) {
        calls.set(name, [...(calls.get(name) ?? []), node]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...calls].flatMap(([name, nodes]) =>
    nodes.length > 1
      ? nodes
          .filter(
            (node) =>
              !node.attributes.properties.some(
                (prop) =>
                  ts.isJsxAttribute(prop) &&
                  prop.name.getText(source) === "moklyInstance",
              ),
          )
          .map(() => file.path + ": repeated " + name + " needs moklyInstance")
      : [],
  );
}

/** Registration must occur in an entry for Mokly to capture its source location. */
export function registrationViolations(files: readonly SourceFile[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file.path,
      file.text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "defineComponent" &&
        !file.path.includes("/entries/")
      ) {
        violations.push(file.path + ": registration belongs in an entry");
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return violations;
}
