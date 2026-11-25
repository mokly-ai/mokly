/** One test result as the verification reporter records it. */
export interface ObservedBrowserTest {
  id: string;
  project: string;
  specFile: string;
  file: string;
  line: number;
  column: number;
  title: string;
  durationMs: number;
  wallMs: number;
  status: string;
  errors: unknown[];
}

/** Playwright reporter that writes the strict runner's event report. */
export default class VerificationReporter {
  observedTests: ObservedBrowserTest[];
  onBegin(config: { rootDir: string }, suite: { allTests(): unknown[] }): void;
  onTestEnd(test: unknown, result: unknown): void;
}
