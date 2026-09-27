import ts from "typescript";

/** One direct real-checkout Git call that reads remote or upstream state. */
export interface RepositoryGitReferenceViolation {
  column: number;
  file: string;
  line: number;
  reference: string;
}

/** Find direct Git subprocess calls that couple tests to real remote state. */
export function findRealRepositoryGitReferences(
  source: string,
  file = "synthetic.ts",
): RepositoryGitReferenceViolation[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );
  const violations: RepositoryGitReferenceViolation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const [command] = node.arguments;
      if (
        command &&
        ts.isStringLiteral(command) &&
        command.text === "git" &&
        node.arguments.some(referencesRepositoryRoot)
      ) {
        const reference = remoteReference(node.arguments);
        if (reference) {
          const position = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
          );
          violations.push({
            column: position.character + 1,
            file,
            line: position.line + 1,
            reference,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

function remoteReference(
  arguments_: ts.NodeArray<ts.Expression>,
): string | undefined {
  for (const argument of arguments_) {
    if (!ts.isArrayLiteralExpression(argument)) continue;
    for (const element of argument.elements) {
      const value = literalValue(element);
      if (value !== undefined && isRemoteReference(value)) return value;
    }
  }
}

function literalValue(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (!ts.isTemplateExpression(node)) return;
  return `${node.head.text}${node.templateSpans
    .map(({ literal }) => `<expression>${literal.text}`)
    .join("")}`;
}

function isRemoteReference(value: string): boolean {
  return (
    value.startsWith("origin/") ||
    value.startsWith("refs/remotes/") ||
    value === "FETCH_HEAD" ||
    value === "--remotes" ||
    ["@{u}", "@{upstream}", "@{push}"].some((suffix) =>
      value.includes(suffix),
    ) ||
    /^branch\..+\.(?:remote|merge)$/u.test(value)
  );
}

function referencesRepositoryRoot(node: ts.Node): boolean {
  let found = false;
  const visit = (candidate: ts.Node): void => {
    if (found) return;
    if (ts.isPropertyAssignment(candidate)) {
      visit(candidate.initializer);
      return;
    }
    if (ts.isPropertyAccessExpression(candidate)) {
      visit(candidate.expression);
      return;
    }
    if (ts.isIdentifier(candidate) && candidate.text === "repositoryRoot") {
      found = true;
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return found;
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".mjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}
