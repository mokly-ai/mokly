import { validateShardReports } from "./report-validation.mjs";

/** Require all eight current-invocation shard reports and live discovered inventories. */
export function validateLocalReports(reports, expected) {
  if (reports.length !== 8)
    throw new Error(`missing or extra local evidence: expected 8 reports`);
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
}
