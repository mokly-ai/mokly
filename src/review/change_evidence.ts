declare const changeEvidenceBrand: unique symbol;

/** Git paths merged with accepted generated-byte and delivered-source evidence. */
export type ChangeEvidence = readonly string[] & {
  readonly [changeEvidenceBrand]: true;
};

/** Freeze an already-merged path set at a trusted classification boundary. */
export function asChangeEvidence(paths: readonly string[]): ChangeEvidence {
  return Object.freeze([...paths]) as ChangeEvidence;
}
