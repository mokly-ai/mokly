import type { BuildWarning } from "../build/warnings.js";

const AUTHORING_WARNINGS = Symbol.for("@mokly/mokly/authoringWarnings");
type WarningCarrier = { [AUTHORING_WARNINGS]?: readonly BuildWarning[] };

/** Carry one ancestor warning through attributed entry copies without serializing it. */
export function attachPathWarning(
  definitions: readonly object[],
  input: object,
  navPath: readonly string[],
  subject: "folder" | "root path",
): void {
  if (!Object.hasOwn(input, "dependencies") || !definitions[0]) return;
  const entry = definitions[0] as WarningCarrier;
  const warning: BuildWarning = {
    code: "removed-dependencies",
    context: [`${subject}:${JSON.stringify(navPath)}`],
    message: `dependencies has been removed; ignoring it on ${subject} ${JSON.stringify(navPath.join(" / "))}. Delete the field.`,
  };
  entry[AUTHORING_WARNINGS] = [...(entry[AUTHORING_WARNINGS] ?? []), warning];
}

/** Read warning metadata before registry preparation projects public entry fields. */
export function authoringWarnings(value: object): readonly BuildWarning[] {
  return (value as WarningCarrier)[AUTHORING_WARNINGS] ?? [];
}
