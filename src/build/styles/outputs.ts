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
  return css
    .split("\n")
    .filter((line) => {
      const match = /^\/\* (.*?) \*\/$/.exec(line);
      return !match || !inputs.has(match[1]!);
    })
    .join("\n");
}
