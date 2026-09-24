import { MoklyError, errorMessage } from "../../errors.js";

import { lightningTransform } from "./lightning.js";

/** Lightning CSS output shared by JavaScript module imports and CSS bundling. */
export interface ScopedStyle {
  readonly css: string;
  readonly exports: Readonly<Record<string, string>>;
  readonly identities: ReadonlySet<string>;
}

/** Scope CSS Modules by repository path without touching global custom properties. */
export function scopeModule(css: string, relative: string): ScopedStyle {
  let result;
  try {
    result = lightningTransform()({
      filename: relative,
      code: Buffer.from(css),
      cssModules: {
        pattern: "mokly_[hash]_[local]",
        dashedIdents: false,
        animation: true,
        grid: false,
        container: false,
        customIdents: true,
        pure: false,
      },
      minify: false,
    });
  } catch (error) {
    throw new MoklyError(
      "build-invalid",
      `could not transform CSS ${relative}: ${errorMessage(error)}; fix the stylesheet and rebuild`,
      { cause: error },
    );
  }
  const records = result.exports ?? {};
  const byScopedName = new Map(
    Object.entries(records).map(([name, record]) => [record.name, name]),
  );
  const cache = new Map<string, string>();
  const names = new Set<string>();
  const expand = (name: string, ancestors: ReadonlySet<string>): string => {
    const previous = cache.get(name);
    if (previous) return previous;
    if (ancestors.has(name))
      throw new MoklyError(
        "build-invalid",
        `CSS Modules composition cycle in ${relative}: ${name}; remove the cycle`,
      );
    const record = records[name]!;
    names.add(record.name);
    const next = new Set([...ancestors, name]);
    const values: string[] = [];
    for (const reference of record.composes) {
      if (reference.type === "dependency")
        throw new MoklyError(
          "build-invalid",
          `CSS Modules cross-file composes is unsupported in ${relative}: ${reference.specifier}; compose within this file or use a global name`,
        );
      values.push(
        reference.type === "global"
          ? reference.name
          : byScopedName.has(reference.name)
            ? expand(byScopedName.get(reference.name)!, next)
            : reference.name,
      );
    }
    values.push(record.name);
    const joined = [...new Set(values.flatMap((value) => value.split(" ")))]
      .filter(Boolean)
      .join(" ");
    cache.set(name, joined);
    return joined;
  };
  const exported = Object.fromEntries(
    Object.keys(records)
      .sort()
      .map((name) => [name, expand(name, new Set())]),
  );
  return {
    css: result.code.toString(),
    exports: exported,
    identities: names,
  };
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
