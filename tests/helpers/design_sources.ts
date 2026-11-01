import fs from "node:fs";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

/**
 * The class tokens that draw each library component's root, and the device
 * frame's caption. A design module outside the library that names all
 * tokens of one entry in a `className` redraws that part.
 */
const LIBRARY_ROOTS: readonly (readonly string[])[] = [
  ["mbk-topbar"],
  ["mbk-nav-head"],
  ["mbk-screen-head"],
  ["mbk-appearance"],
  ["mbk-diff-toolbar"],
  ["mbk-view-tools"],
  ["mbk-tag-picker"],
  ["mbk-chip", "tag"],
  ["mbk-entry-status"],
  ["mbk-inspector"],
  ["mbk-meta-row"],
  ["mbk-control-field"],
  ["phone-frame"],
  ["browser-frame"],
  ["mbk-frame-label"],
  ["mb-pane"],
  ["mbk-empty"],
  ["flow-step"],
];

/** The end of the brace group that opens at `start`. */
function braceEnd(source: string, start: number): number {
  let depth = 0;
  for (let at = start; at < source.length; at++)
    if (source[at] === "{") depth++;
    else if (source[at] === "}" && --depth === 0) return at;
  return source.length - 1;
}

/**
 * The class tokens of each `className` attribute: every string and template
 * literal in its value, with substitutions removed.
 */
function classNameTokens(source: string): string[][] {
  return [...source.matchAll(/className=(["'{])/gu)].map((match) => {
    const start = match.index + "className=".length;
    const end =
      match[1] === "{"
        ? braceEnd(source, start)
        : source.indexOf(match[1]!, start + 1);
    const value = source.slice(start, end + 1);
    return [...value.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/gu)]
      .map((literal) =>
        (literal[1] ?? literal[2] ?? literal[3] ?? "").replace(
          /\$\{[^}]*\}/gu,
          " ",
        ),
      )
      .join(" ")
      .split(/\s+/u)
      .filter(Boolean);
  });
}

/**
 * Composition outside the library uses the registered components: no module
 * imports a library implementation, and none redraws a library root.
 */
export function bypassViolations(): string[] {
  const root = path.join(repositoryRoot, "examples/basic/specs/design");
  return fs
    .readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/u.test(file) && !file.startsWith("library/"))
    .flatMap((file) => {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      const tokens = classNameTokens(source);
      return [
        ...(/from ["'][^"']*\.view\.js["']/u.test(source)
          ? [`${file} imports a library implementation`]
          : []),
        ...LIBRARY_ROOTS.filter((root) =>
          tokens.some((list) => root.every((token) => list.includes(token))),
        ).map((root) => `${file} redraws ${root.join(" ")}`),
      ];
    });
}
