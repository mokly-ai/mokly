import { createHash } from "node:crypto";

import postcss, { CssSyntaxError, type Root } from "postcss";

import { MoklyError } from "../../errors.js";

import { modulePlugins } from "./module_plugins.js";

/** Rename-only CSS output shared by JavaScript imports and CSS bundling. */
export interface ScopedStyle {
  readonly css: string;
  readonly exports: Readonly<Record<string, string>>;
  readonly identities: ReadonlySet<string>;
}

/** Rename local CSS identities using a hash of only the repository path. */
export function scopeModule(css: string, relative: string): ScopedStyle {
  const hash = createHash("sha256")
    .update(relative, "utf8")
    .digest("hex")
    .slice(0, 12);
  const prefix = `mokly_${hash}_`;
  let root: Root | undefined;
  try {
    root = postcss.parse(css, { from: relative });
    rejectAuthoredICSS(root, relative);
    const plugins = modulePlugins();
    const result = postcss([
      plugins.localByDefault({ mode: "local" }),
      plugins.extractImports(),
      plugins.scope({
        generateScopedName: (name: string) => `${prefix}${name}`,
      }),
    ])
      .process(root, { from: relative, map: false })
      .sync();
    const { icssImports, icssExports } = plugins.extractICSS(result.root);
    const specifier = Object.keys(icssImports).sort()[0];
    if (specifier)
      throw new MoklyError(
        "build-invalid",
        `CSS Modules cross-file composes is unsupported in ${relative}: ${specifier}; compose within this file or use a global name`,
      );
    const exported = Object.fromEntries(
      Object.keys(icssExports)
        .sort()
        .map((name) => [name, icssExports[name]!]),
    );
    const identities = new Set(
      Object.values(exported)
        .flatMap((value) => value.split(" "))
        .filter((name) => name.startsWith(prefix)),
    );
    return { css: result.root.toString(), exports: exported, identities };
  } catch (error) {
    if (error instanceof MoklyError) throw error;
    throw moduleError(error, relative, root);
  }
}

/** Reject two source files claiming an identical scoped CSS identity. */
export function recordModuleIdentities(
  identities: ReadonlySet<string>,
  relative: string,
  known: Map<string, string>,
): void {
  for (const name of identities) {
    const first = known.get(name);
    if (first && first !== relative)
      throw new MoklyError(
        "build-invalid",
        `CSS Modules generated name collision: ${name} in ${first} and ${relative}; rename one local name or file`,
      );
    known.set(name, relative);
  }
}

function rejectAuthoredICSS(root: Root, relative: string): void {
  root.walkRules((rule) => {
    const selector = rule.selector.trim();
    if (selector !== ":export" && !/^:import\(/.test(selector)) return;
    const start = rule.source?.start;
    throw new MoklyError(
      "build-invalid",
      `CSS Modules authored ICSS rule is unsupported in ${relative}:${start?.line ?? 1}:${start?.column ?? 1}: ${selector}; use local class exports or ordinary CSS`,
    );
  });
  root.walkAtRules((rule) => {
    const name = rule.name.toLowerCase();
    const start = rule.source?.start;
    if (name === "icss-import" || name === "icss-export")
      throw new MoklyError(
        "build-invalid",
        `CSS Modules authored ICSS rule is unsupported in ${relative}:${start?.line ?? 1}:${start?.column ?? 1}: @${name}; use local class exports or ordinary CSS`,
      );
    if (name !== "value") return;
    throw new MoklyError(
      "build-invalid",
      `CSS Modules @value is unsupported in ${relative}:${start?.line ?? 1}:${start?.column ?? 1}; use a CSS custom property or JavaScript constant`,
    );
  });
}

function moduleError(
  error: unknown,
  relative: string,
  root?: Root,
): MoklyError {
  if (error instanceof CssSyntaxError) {
    const location = `${relative}:${error.line}:${error.column}`;
    const missing =
      /^referenced class name "([^"]+)" in composes not found$/.exec(
        error.reason,
      );
    if (missing)
      return new MoklyError(
        "build-invalid",
        `CSS Modules composition refers to a class not yet defined in ${location}: ${missing[1]}; define the composed class before this rule`,
        { cause: error },
      );
    if (
      /composition is only allowed|composition is not allowed in nested rule/.test(
        error.reason,
      )
    )
      return new MoklyError(
        "build-invalid",
        `CSS Modules composition requires a single local class in ${location}; compose from a local class selector`,
        { cause: error },
      );
    return new MoklyError(
      "build-invalid",
      `could not transform CSS ${location}: ${error.reason}; fix the stylesheet and rebuild`,
      { cause: error },
    );
  }
  if (
    error instanceof Error &&
    /composition is only allowed|composition is not allowed in nested rule/.test(
      error.message,
    )
  ) {
    let location = `${relative}:1:1`;
    root?.walkDecls("composes", (declaration) => {
      const start = declaration.source?.start;
      if (start) location = `${relative}:${start.line}:${start.column}`;
      return false;
    });
    return new MoklyError(
      "build-invalid",
      `CSS Modules composition requires a single local class in ${location}; compose from a local class selector`,
      { cause: error },
    );
  }
  return new MoklyError(
    "build-invalid",
    `could not transform CSS ${relative}:1:1: unsupported CSS Modules syntax; fix the stylesheet and rebuild`,
    { cause: error },
  );
}

/** Format an esbuild-compatible CSS Modules default map and named bindings. */
export function moduleBindings(
  exports: Readonly<Record<string, string>>,
): string {
  const entries = Object.entries(exports);
  const named = entries.flatMap(([name, value]) =>
    /^[$A-Z_a-z][$\w]*$/.test(name) && !RESERVED.has(name)
      ? [`export const ${name} = ${JSON.stringify(value)};`]
      : [],
  );
  return `export default ${JSON.stringify(exports)};\n${named.join("\n")}`;
}

const RESERVED = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "let",
  "static",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
]);
