import ts from "typescript";

/** One direct real-checkout Git call that reads remote or upstream state. */
export interface RepositoryGitReferenceViolation {
  column: number;
  file: string;
  line: number;
  reference: string;
}

/**
 * Find literal remote reads in direct Git calls whose pre-subcommand target or
 * inline `cwd` is the real checkout; unknown option objects are not reported.
 */
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
    if (value !== undefined && isDirectRemoteReference(value)) return value;
  }
  const { subcommand, subcommandIndex } = parseGitInvocation(argv);
  if (subcommand === "fetch" || subcommand === "ls-remote") return subcommand;
  if (
    subcommand !== undefined &&
    subcommandIndex !== undefined &&
    REFERENCE_LISTING_SUBCOMMANDS.has(subcommand)
  )
    for (const value of values.slice(subcommandIndex + 1))
      if (value !== undefined && isReferenceListingFlag(value)) return value;
}

function literalValue(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (!ts.isTemplateExpression(node)) return;
  return `${node.head.text}${node.templateSpans
    .map(({ literal }) => `<expression>${literal.text}`)
    .join("")}`;
}

function isDirectRemoteReference(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    value.includes("origin/") ||
    value.includes("remotes/") ||
    value.includes("refs/remotes") ||
    value === "FETCH_HEAD" ||
    ["@{u}", "@{upstream}", "@{push}"].some((suffix) =>
      lower.includes(suffix),
    ) ||
    /^branch\..+\.(?:remote|merge)$/iu.test(value)
  );
}

const GLOBAL_VALUE_OPTIONS = [
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--config-env",
] as const;
const TARGET_OPTIONS = new Set<string>(["-C", "--git-dir"]);
const REFERENCE_LISTING_SUBCOMMANDS = new Set([
  "branch",
  "show-branch",
  "log",
  "rev-list",
  "rev-parse",
  "describe",
  "name-rev",
  "shortlog",
]);

function isReferenceListingFlag(value: string): boolean {
  return (
    value === "-r" ||
    value === "-a" ||
    value === "--all" ||
    value === "--remotes" ||
    value.startsWith("--remotes=")
  );
}

interface GitInvocation {
  readonly subcommand?: string;
  readonly subcommandIndex?: number;
  readonly target?: ts.Expression | undefined;
  readonly targetKnown: boolean;
}

function parseGitInvocation(argv: ts.ArrayLiteralExpression): GitInvocation {
  let target: ts.Expression | undefined;
  for (let index = 0; index < argv.elements.length; index++) {
    const element = argv.elements[index];
    if (!element || !ts.isExpression(element))
      return { target, targetKnown: false };
    const value = literalValue(element);
    if (value === undefined) return { target, targetKnown: false };
    const option = globalValueOption(value);
    if (option) {
      if (option.assigned) {
        if (TARGET_OPTIONS.has(option.name)) target = element;
        continue;
      }
      const candidate = argv.elements[index + 1];
      if (!candidate || !ts.isExpression(candidate))
        return { target, targetKnown: false };
      if (TARGET_OPTIONS.has(option.name)) target = candidate;
      index++;
      continue;
    }
    if (value.startsWith("-")) continue;
    return {
      subcommand: value,
      subcommandIndex: index,
      target,
      targetKnown: true,
    };
  }
  return { target, targetKnown: true };
}

function globalValueOption(
  value: string,
): { assigned: boolean; name: string } | undefined {
  for (const option of GLOBAL_VALUE_OPTIONS) {
    if (value === option) return { assigned: false, name: option };
    if (value.startsWith(`${option}=`)) return { assigned: true, name: option };
  }
}

function targetsRealRepository(
  arguments_: ts.NodeArray<ts.Expression>,
): boolean {
  const argv = argumentArray(arguments_);
  if (!argv) return false;
  const invocation = parseGitInvocation(argv);
  if (!invocation.targetKnown) return false;
  if (invocation.target) return referencesRepositoryRoot(invocation.target);
  return optionsTarget(arguments_) === "real";
}

function argumentArray(
  arguments_: ts.NodeArray<ts.Expression>,
): ts.ArrayLiteralExpression | undefined {
  const argv = arguments_[1];
  return argv && ts.isArrayLiteralExpression(argv) ? argv : undefined;
}

function optionsTarget(
  arguments_: ts.NodeArray<ts.Expression>,
): "real" | "other" | "unknown" {
  const options = arguments_[2];
  if (options === undefined) return "real";
  if (!ts.isObjectLiteralExpression(options)) return "unknown";
  if (options.properties.some(ts.isSpreadAssignment)) return "unknown";
  for (const property of options.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === "cwd"
    )
      return referencesRepositoryRoot(property.initializer) ? "real" : "other";
    if (
      ts.isShorthandPropertyAssignment(property) &&
      property.name.text === "cwd"
    )
      return referencesRepositoryRoot(property.name) ? "real" : "other";
  }
  return "real";
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
