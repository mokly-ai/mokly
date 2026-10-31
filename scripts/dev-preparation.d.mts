/** The process and output boundary of the preparation. */
export interface DevelopmentPreparation {
  /** Run npm with the arguments at the repository root and resolve its exit status. */
  run(args: readonly string[]): Promise<number>;
  /** Print one progress line. */
  report(message: string): void;
}

/** Install and build the checkout when `npm run dev` cannot serve it yet. */
export function prepareDevelopment(
  repositoryRoot: string,
  preparation: DevelopmentPreparation,
): Promise<void>;
