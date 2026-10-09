import { isBuildDiagnostic, type BuildDiagnostic } from "./build_warnings.js";

/** A diagnostic retains the build attempt that supplied its rendering inputs. */
export interface GenerationWarning {
  readonly generation: string;
  readonly warning: BuildDiagnostic;
}

/** Validate the same producer envelope at worker and child-process boundaries. */
export function isGenerationWarning(
  value: unknown,
): value is GenerationWarning {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GenerationWarning>;
  return (
    typeof candidate.generation === "string" &&
    /^[a-f0-9]{32}$/.test(candidate.generation) &&
    isBuildDiagnostic(candidate.warning)
  );
}
