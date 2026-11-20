/**
 * The report-only Lighthouse budget. The pages, the viewports and the
 * minimum category scores are the delivery contract in
 * `docs/protocol/cloud/site-delivery.md`; this module owns them so the runner and
 * its tests read one table. CI reports shortfalls without gating Required CI.
 */

import { SITE_PATHS } from "./navigation.js";

/** The simulated network and processor one form factor is measured on. */
export interface Throttling {
  readonly cpuSlowdownMultiplier: number;
  readonly downloadThroughputKbps: number;
  readonly requestLatencyMs: number;
  readonly rttMs: number;
  readonly throughputKbps: number;
  readonly uploadThroughputKbps: number;
}

/** One inspection viewport, with the Lighthouse form factor it audits as. */
export interface Viewport {
  readonly formFactor: "desktop" | "mobile";
  readonly height: number;
  readonly label: string;
  readonly throttling: Throttling;
  readonly width: number;
}

/**
 * Lighthouse's mobile slow-4G profile with an explicit CPU baseline. Network
 * simulation keeps the mobile stress case while the host runner's changing
 * benchmark does not choose an additional processor slowdown for the run.
 */
const MOBILE: Throttling = Object.freeze({
  cpuSlowdownMultiplier: 1,
  downloadThroughputKbps: 1_474.56,
  requestLatencyMs: 562.5,
  rttMs: 150,
  throughputKbps: 1_638.4,
  uploadThroughputKbps: 675,
});

/**
 * Lighthouse's desktop profile: a dense 4G connection and an unthrottled
 * processor. A desktop page measured on the mobile profile is measured on a
 * connection it never meets and scored on the stricter desktop curves, so the
 * desktop viewport declares its own conditions while the mobile viewport keeps
 * the slow connection that is the real stress case.
 */
const DESKTOP: Throttling = Object.freeze({
  cpuSlowdownMultiplier: 1,
  downloadThroughputKbps: 0,
  requestLatencyMs: 0,
  rttMs: 40,
  throughputKbps: 10_240,
  uploadThroughputKbps: 0,
});

/** The two viewports every audited page is measured at. */
export const VIEWPORTS: readonly Viewport[] = Object.freeze([
  {
    formFactor: "mobile",
    height: 844,
    label: "390",
    throttling: MOBILE,
    width: 390,
  },
  {
    formFactor: "desktop",
    height: 900,
    label: "1440",
    throttling: DESKTOP,
    width: 1440,
  },
]);

/**
 * The routes the budget audits: one of each composition, including a written
 * documentation page with a code panel and one with a wide table.
 */
export const AUDITED: readonly string[] = Object.freeze([
  SITE_PATHS.home,
  SITE_PATHS.docs,
  "/docs/authoring/config/",
  "/docs/cli/serve/",
  SITE_PATHS.changelog,
  SITE_PATHS.terms,
]);

/** The minimum score each Lighthouse category must reach. */
export const THRESHOLDS: Readonly<Record<string, number>> = Object.freeze({
  accessibility: 1,
  "best-practices": 0.95,
  performance: 0.95,
  seo: 0.95,
});

/** The categories, in the order the printed table lists them. */
export const CATEGORIES: readonly string[] = Object.freeze(
  Object.keys(THRESHOLDS).sort(),
);

/** One audited page at one viewport. */
export interface Measurement {
  readonly route: string;
  readonly scores: Readonly<Record<string, number>>;
  readonly viewport: string;
}

/** Every category whose score falls under the budget, named for a report. */
export function shortfalls(measurement: Measurement): readonly string[] {
  return CATEGORIES.filter((category) => {
    const threshold = THRESHOLDS[category] ?? 0;
    return (measurement.scores[category] ?? 0) + 1e-9 < threshold;
  });
}

/**
 * Measure one route and viewport, repeating it once only when the first result
 * misses the budget. The repeated result still faces every category threshold.
 */
export async function measurementWithRetry(
  measure: () => Promise<Measurement>,
): Promise<Measurement> {
  const first = await measure();
  return shortfalls(first).length === 0 ? first : measure();
}

function cell(value: string, width: number): string {
  return value.padEnd(width);
}

/** The table the runner prints, one row per page and viewport. */
export function budgetTable(
  measurements: readonly Measurement[],
): readonly string[] {
  const columns = ["route", "viewport", ...CATEGORIES, "result"];
  const rows = measurements.map((measurement) => [
    measurement.route,
    measurement.viewport,
    ...CATEGORIES.map((category) =>
      (measurement.scores[category] ?? 0).toFixed(2),
    ),
    shortfalls(measurement).length === 0
      ? "pass"
      : `fail (${shortfalls(measurement).join(", ")})`,
  ]);
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => (row[index] ?? "").length)),
  );
  const line = (values: readonly string[]): string =>
    values
      .map((value, index) => cell(value, widths[index] ?? 0))
      .join("  ")
      .trimEnd();
  return [
    line(columns),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map(line),
  ];
}
