/**
 * The Lighthouse budget the site is held to. The pages, the viewports and the
 * minimum category scores are the delivery contract in
 * `docs/protocol/site-delivery.md`; this module owns them so the runner and
 * its tests read one table.
 */

import { SITE_PATHS, type SitePath } from "./navigation.js";

/** One inspection viewport, with the Lighthouse form factor it audits as. */
export interface Viewport {
  readonly formFactor: "desktop" | "mobile";
  readonly height: number;
  readonly label: string;
  readonly width: number;
}

/** The two viewports every audited page is measured at. */
export const VIEWPORTS: readonly Viewport[] = Object.freeze([
  { formFactor: "mobile", height: 844, label: "390", width: 390 },
  { formFactor: "desktop", height: 900, label: "1440", width: 1440 },
]);

/** The routes the budget audits. */
export const AUDITED: readonly SitePath[] = Object.freeze([
  SITE_PATHS.home,
  SITE_PATHS.docs,
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
