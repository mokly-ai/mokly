import ts from "typescript";

/** One browser module's path and authored TypeScript source. */
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

type Assignments = ReadonlyMap<string, readonly ts.Expression[]>;

function callName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isStringLiteral(expression.argumentExpression)
  )
    return expression.argumentExpression.text;
  return "";
}

function unwrapped(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isAwaitExpression(expression)
  )
    return unwrapped(expression.expression);
  return expression;
}

/** All assignments must preserve the helper result before a URL is trusted. */
function isArtboardResult(
  expression: ts.Expression,
  assignments: Assignments,
  helperNames: ReadonlySet<string>,
  seen: ReadonlySet<string> = new Set(),
): boolean {
  const value = unwrapped(expression);
  if (ts.isCallExpression(value))
    return helperNames.has(callName(value.expression));
  if (!ts.isIdentifier(value) || seen.has(value.text)) return false;
  const sources = assignments.get(value.text);
  return Boolean(
    sources?.length &&
    sources.every((source) =>
      isArtboardResult(
        source,
        assignments,
        helperNames,
        new Set([...seen, value.text]),
      ),
    ),
  );
}

/** Resolve path pieces without executing the authored module. */
function pathSegments(
  expression: ts.Expression,
  assignments: Assignments,
  seen: ReadonlySet<string> = new Set(),
): string[] {
  const value = unwrapped(expression);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    return value.text.split(/[\\/]+/u);
  if (ts.isTemplateExpression(value))
    return [
      ...value.head.text.split(/[\\/]+/u),
      ...value.templateSpans.flatMap((span) => [
        ...pathSegments(span.expression, assignments, seen),
        ...span.literal.text.split(/[\\/]+/u),
      ]),
    ];
  if (ts.isIdentifier(value)) {
    if (seen.has(value.text)) return [];
    const sources = assignments.get(value.text);
    return sources?.length
      ? sources.flatMap((source) =>
          pathSegments(source, assignments, new Set([...seen, value.text])),
        )
      : [value.text];
  }
  if (
    ts.isCallExpression(value) &&
    ["join", "resolve"].includes(callName(value.expression))
  )
    return value.arguments.flatMap((argument) =>
      pathSegments(argument, assignments, seen),
    );
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.PlusToken
  )
    return [
      ...pathSegments(value.left, assignments, seen),
      ...pathSegments(value.right, assignments, seen),
    ];
  return [];
}

function isGeneratedDesign(segments: readonly string[]): boolean {
  const generated = segments.indexOf("generated");
  return generated >= 0 && segments.slice(generated + 1).includes("design");
}

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
    let rawDesignPath = false;
    const forbiddenCalls = new Set<string>();
    const helperNames = new Set(["designArtboardUrl"]);
    const fileUrlNames = new Set(["pathToFileURL"]);
    const assignments = new Map<string, ts.Expression[]>();

    const assign = (name: string, expression: ts.Expression): void => {
      assignments.set(name, [...(assignments.get(name) ?? []), expression]);
    };
    const collect = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      )
        assign(node.name.text, node.initializer);
      if (
        ts.isBinaryExpression(node) &&
        ts.isIdentifier(node.left) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      )
        assign(node.left.text, node.right);
      ts.forEachChild(node, collect);
    };
    collect(tree);

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
          if (original === "designArtboardUrl") {
            importsArtboard = true;
            helperNames.add(binding.name.text);
          }
          if (runtimeCall.test(original)) forbiddenCalls.add(binding.name.text);
          if (original === "pathToFileURL") fileUrlNames.add(binding.name.text);
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
        const name = callName(node.expression);
        if (runtimeCall.test(name) || forbiddenCalls.has(name))
          usesRuntime = true;
        if (name === "goto") {
          const target = node.arguments[0];
          if (!target || !isArtboardResult(target, assignments, helperNames))
            usesRuntime = true;
        }
        if (
          ["join", "resolve"].includes(name) &&
          isGeneratedDesign(pathSegments(node, assignments))
        )
          rawDesignPath = true;
        if (
          fileUrlNames.has(name) &&
          node.arguments.some((argument) =>
            pathSegments(argument, assignments).includes("design"),
          )
        )
          rawDesignPath = true;
      }
      if (
        ts.isTemplateExpression(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        if (isGeneratedDesign(pathSegments(node, assignments)))
          rawDesignPath = true;
        const head = ts.isTemplateExpression(node) ? node.head.text : node.text;
        if (
          /^file:\/\//u.test(head) &&
          pathSegments(node, assignments).includes("design")
        )
          rawDesignPath = true;
      }
      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)) &&
        /^file:\/\//u.test(node.text) &&
        node.text.split(/[\\/]+/u).includes("design")
      )
        rawDesignPath = true;
      ts.forEachChild(node, visit);
    };
    visit(tree);

    if (inDesign && usesRuntime)
      return [{ path: file, rule: "design-runtime" as const }];
    if (
      !inDesign &&
      (importsArtboard ||
        rawDesignPath ||
        /generated[\\/]design(?:[\\/]|["'`])/u.test(source))
    )
      return [{ path: file, rule: "runtime-artboard" as const }];
    return [];
  });
}
