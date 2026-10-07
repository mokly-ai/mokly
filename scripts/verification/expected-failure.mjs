/** An expected failure whose message is the complete developer-facing report. */
export class ExpectedFailure extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "ExpectedFailure";
  }
}
