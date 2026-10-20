import fs from "node:fs/promises";

import type {
  FullResult,
  Reporter,
  TestResult,
} from "@playwright/test/reporter";

/** Require every assigned delivery test to finish once with a passing result. */
export default class StaticDeliveryReporter implements Reporter {
  private expected: string[] = [];
  private observed: { id: string; status: TestResult["status"] }[] = [];
  private errors: string[] = [];

  constructor(
    private readonly options: { outputFile?: string } = {},
    private readonly write: (
      file: string,
      text: string,
    ) => Promise<void> = fs.writeFile,
  ) {}

  onBegin(_config: unknown, suite: { allTests(): { id: string }[] }): void {
    this.expected = suite.allTests().map((test) => test.id);
  }

  onTestEnd(
    test: { id: string },
    result: { status: TestResult["status"] },
  ): void {
    this.observed.push({ id: test.id, status: result.status });
  }

  onError(error: { message?: string }): void {
    this.errors.push(error.message ?? "Playwright reported an error");
  }

  async onEnd(result: { status: FullResult["status"] }): Promise<{
    status: "passed" | "failed";
  }> {
    const ids = new Set(this.observed.map((test) => test.id));
    const passed =
      result.status === "passed" &&
      this.errors.length === 0 &&
      this.expected.length > 0 &&
      new Set(this.expected).size === this.expected.length &&
      this.observed.length === this.expected.length &&
      ids.size === this.expected.length &&
      this.expected.every((id) => ids.has(id)) &&
      this.observed.every((test) => test.status === "passed");
    const status = passed ? "passed" : "failed";
    const file =
      this.options.outputFile ?? process.env["MOKLY_DELIVERY_REPORT"];
    if (!file) throw new Error("MOKLY_DELIVERY_REPORT is required");
    await this.write(
      file,
      JSON.stringify(
        {
          scope: "static-delivery",
          status,
          expected: this.expected,
          observed: this.observed,
          errors: this.errors,
        },
        null,
        2,
      ) + "\n",
    );
    if (!passed)
      console.error(
        "Static delivery requires every assigned test to pass once.",
      );
    return { status };
  }
}
