import assert from "node:assert/strict";

/** The delivery modes in the order that a complete check runs them. */
export const DELIVERY_MODES = ["static-http", "file"];

/**
 * Select the delivery modes before any build: both without arguments, or the
 * one mode of `--mode MODE`, so that CI can check each mode in its own job.
 * @param {readonly string[]} args
 * @returns {string[]}
 */
export function deliveryModes(args) {
  if (args.length === 0) return [...DELIVERY_MODES];
  if (
    args.length !== 2 ||
    args[0] !== "--mode" ||
    !DELIVERY_MODES.includes(args[1] ?? "")
  )
    throw new Error(`expected --mode ${DELIVERY_MODES.join(" or --mode ")}`);
  return [args[1]];
}

/**
 * The parent owns acceptance because Playwright can suppress reporter errors.
 * @param {() => Promise<void>} run
 * @param {() => Promise<unknown>} read
 */
export async function checkDeliveryMode(run, read) {
  await run();
  validateReport(await read());
}

/** @param {unknown} report */
function validateReport(report) {
  assert.ok(
    report !== null &&
      typeof report === "object" &&
      "scope" in report &&
      report.scope === "static-delivery" &&
      "status" in report &&
      report.status === "passed" &&
      "expected" in report &&
      Array.isArray(report.expected) &&
      "observed" in report &&
      Array.isArray(report.observed) &&
      "errors" in report &&
      Array.isArray(report.errors) &&
      report.errors.length === 0,
    "static delivery requires a valid passing report without reporter errors",
  );
  /** @type {unknown[]} */
  const assigned = report.expected;
  /** @type {string[]} */
  const expected = [];
  for (const id of assigned) {
    assert.ok(
      typeof id === "string" && id.length > 0,
      "invalid assigned delivery ID",
    );
    expected.push(id);
  }
  assert.ok(expected.length > 0, "static delivery inventory must not be empty");
  assert.equal(
    new Set(expected).size,
    expected.length,
    "duplicate assigned delivery ID",
  );
  /** @type {unknown[]} */
  const results = report.observed;
  /** @type {string[]} */
  const observed = [];
  for (const result of results) {
    assert.ok(
      result !== null &&
        typeof result === "object" &&
        "id" in result &&
        typeof result.id === "string" &&
        result.id.length > 0 &&
        "status" in result &&
        result.status === "passed",
      "every observed delivery test must pass",
    );
    observed.push(result.id);
  }
  assert.equal(
    new Set(observed).size,
    observed.length,
    "duplicate observed delivery ID",
  );
  assert.deepEqual(
    observed.sort(),
    expected.sort(),
    "delivery results must match assigned tests",
  );
}
