/** An expected failure whose message is the complete developer-facing report. */
export class ExpectedFailure extends Error {
  constructor(message: string, options?: ErrorOptions);
}
