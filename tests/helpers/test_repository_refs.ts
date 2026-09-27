import ts from "typescript";

/** One direct real-checkout Git call that reads remote or upstream state. */
export interface RepositoryGitReferenceViolation {
  column: number;
  file: string;
  line: number;
  reference: string;
}

/** Find literal direct Git calls that read remote state from the real checkout. */
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
        targetsRealRepository(node.arguments)
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
  const argv = argumentArray(arguments_);
  if (!argv) return;
  const values = argv.elements.map(literalValue);
  for (const value of values) {
    if (value !== undefined && isRemoteReference(value)) return value;
  }
  const subcommand = gitSubcommand(values);
  if (subcommand === "fetch" || subcommand === "ls-remote") return subcommand;
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
  const lower = value.toLowerCase();
  return (
    value.includes("origin/") ||
    value.includes("remotes/") ||
    value.includes("refs/remotes") ||
    value === "FETCH_HEAD" ||
    value === "-r" ||
    value === "--all" ||
    value === "--remotes" ||
    value.startsWith("--remotes=") ||
    ["@{u}", "@{upstream}", "@{push}"].some((suffix) =>
      lower.includes(suffix),
    ) ||
    /^branch\..+\.(?:remote|merge)$/iu.test(value)
  );
}

function gitSubcommand(
  values: readonly (string | undefined)[],
): string | undefined {
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (value === undefined) return;
    if (value === "-C") {
      index++;
      continue;
    }
    if (value.startsWith("-")) continue;
    return value;
  }
}

function targetsRealRepository(
  arguments_: ts.NodeArray<ts.Expression>,
): boolean {
  const argv = argumentArray(arguments_);
  const gitTarget = argv ? lastGitTarget(argv) : undefined;
  if (gitTarget) return referencesRepositoryRoot(gitTarget);
  const cwd = cwdTarget(arguments_);
  return cwd === undefined || referencesRepositoryRoot(cwd);
}

function argumentArray(
  arguments_: ts.NodeArray<ts.Expression>,
): ts.ArrayLiteralExpression | undefined {
  const argv = arguments_[1];
  return argv && ts.isArrayLiteralExpression(argv) ? argv : undefined;
}

function lastGitTarget(
  argv: ts.ArrayLiteralExpression,
): ts.Expression | undefined {
  let target: ts.Expression | undefined;
  for (let index = 0; index < argv.elements.length - 1; index++) {
    const element = argv.elements[index];
    if (element && literalValue(element) === "-C") {
      const candidate = argv.elements[index + 1];
      if (candidate && ts.isExpression(candidate)) target = candidate;
      index++;
    }
  }
  return target;
}

function cwdTarget(
  arguments_: ts.NodeArray<ts.Expression>,
): ts.Expression | undefined {
  for (const argument of arguments_.slice(2)) {
    if (!ts.isObjectLiteralExpression(argument)) continue;
    for (const property of argument.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        propertyName(property.name) === "cwd"
      )
        return property.initializer;
    }
  }
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
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
