import type { Metafile } from "esbuild";

import { MoklyError } from "../../errors.js";
import { generatedBytes, type GeneratedFile } from "../generated_file.js";

/** Add a generated stylesheet or asset without masking a divergent shared asset. */
export function acceptStyleOutput(
  outputs: Map<string, GeneratedFile>,
  route: string,
  content: GeneratedFile,
): void {
  const previous = outputs.get(route);
  if (
    previous !== undefined &&
    !generatedBytes(previous).equals(generatedBytes(content))
  )
    throw new MoklyError(
      "build-invalid",
      `CSS asset bytes disagree at ${route}; keep shared asset inputs stable during the build`,
    );
  outputs.set(route, content);
}

/** Remove only esbuild-inserted source-path comments from CSS output. */
export function stripSourcePathComments(
  css: string,
  metafile: Metafile,
): string {
  const inputs = new Set(Object.keys(metafile.inputs));
  const lines: string[] = [];
  for (const line of css.split("\n")) {
    const match = /^\/\* (.*?) \*\/$/.exec(line);
    if (match && inputs.has(match[1]!)) {
      if (lines.at(-1) === "") lines.pop();
    } else lines.push(line);
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}
