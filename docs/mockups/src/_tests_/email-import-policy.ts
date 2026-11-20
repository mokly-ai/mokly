import ts from "typescript";

import type { SourceFile } from "./source-policy";

/** What `src/emails/` may import, so a catalogue change cannot reach a message. */
export function emailImportViolations(file: SourceFile): string[] {
  const source = ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  return source.statements.flatMap((node) => {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      return [];
    const specifier = node.moduleSpecifier.text;
    const allowed =
      specifier === "react" ||
      specifier.startsWith("@mokly-cloud/tokens/") ||
      (specifier.startsWith("./") && !specifier.includes(".."));
    return allowed ? [] : [file.path + ": emails cannot import " + specifier];
  });
}
