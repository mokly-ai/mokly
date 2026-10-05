import path from "node:path";

import ts from "typescript";

import { typedBranchPointViolations } from "./branch_point_type_guard.js";
import { repositoryRoot } from "./fixture.js";

/** Check samples against the repository's actual path and evidence types. */
export function checkBranchPointSample(text: string) {
  const file = path.join(repositoryRoot, "tests/__branch_point_probe.ts");
  const host = ts.createCompilerHost({});
  const readFile = host.readFile;
  host.readFile = (name) => (name === file ? text : readFile(name));
  const program = ts.createProgram(
    [file],
    {
      strict: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
    },
    host,
  );
  const source = program.getSourceFile(file)!;
  return {
    diagnostics: program
      .getSemanticDiagnostics(source)
      .map((item) => item.code),
    violations: typedBranchPointViolations(source, program.getTypeChecker()),
  };
}
