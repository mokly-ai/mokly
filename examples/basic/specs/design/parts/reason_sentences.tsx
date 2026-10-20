/** A direct change reason of the routed entry, by its review kind. */
export type ChangeReasonKind =
  | "added"
  | "removed"
  | "material"
  | "implementation"
  | "inputs"
  | "structure"
  | "metadata"
  | "dependency";

/** Each reason's sentence, as the component workspace design contract fixes it. */
const SENTENCES: Record<Exclude<ChangeReasonKind, "dependency">, string> = {
  added: "Added to this branch.",
  removed: "Removed on this branch.",
  material: "Rendered content changed.",
  implementation: "Rendered content changed where this component is used.",
  inputs: "Supplied props or slots changed.",
  structure: "Component instances changed.",
  metadata: "Page details or saved examples changed.",
};

/**
 * One sentence per reason, after the branch-point sentence of Details. A
 * `dependency` reason has no sentence: it reads only through the list of
 * changed files.
 */
export function ReasonSentences({
  reasons,
}: {
  reasons: readonly ChangeReasonKind[];
}) {
  return (
    <>
      {reasons.map((reason) =>
        reason === "dependency" ? null : (
          <p key={reason}>{SENTENCES[reason]}</p>
        ),
      )}
    </>
  );
}
