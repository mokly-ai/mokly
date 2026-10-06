import {
  validatePlaywrightPartition,
  validateShardReports,
  validateUnshardedReport,
} from "./report-validation.mjs";

/** Require every current-invocation suite report and live discovered inventory. */
export function validateLocalReports(reports, expected) {
  if (reports.length !== 9)
    throw new Error(`missing or extra local evidence: expected 9 reports`);
  for (const suite of ["unit", "browser"]) {
    const group = reports.filter((report) => report.suite === suite);
    validateShardReports(group, {
      commit: expected.commit,
      runtime: expected.runtime,
      suite,
      total: 4,
    });
    const actual =
      suite === "unit"
        ? group[0].fullFiles
        : group[0].fullTests.map((test) => test.id);
    const discovered =
      suite === "unit"
        ? expected.unitFiles
        : expected.browserTests.map((test) => test.id);
    if (
      actual.length !== discovered.length ||
      actual.slice().sort().join("\n") !== discovered.slice().sort().join("\n")
    )
      throw new Error(
        `${suite} reports differ from live independent discovery`,
      );
  }
  const hydration = reports.find((report) => report.suite === "hydration");
  validateUnshardedReport(hydration, { ...expected, suite: "hydration" });
  const browser = reports.filter((report) => report.suite === "browser");
  validatePlaywrightPartition(browser, hydration);
  if (reports.some((report) => report.nodeVersion !== hydration.nodeVersion))
    throw new Error("local suites used different Node versions");
  const actual = hydration.fullTests.map((test) => test.id).sort();
  const discovered = expected.hydrationTests.map((test) => test.id).sort();
  if (actual.join("\n") !== discovered.join("\n"))
    throw new Error("hydration reports differ from live independent discovery");
}
