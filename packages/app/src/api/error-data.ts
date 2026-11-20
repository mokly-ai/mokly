import type { components } from "./generated/schema";
import type { IneligibleCause, Plan, SlugField } from "./types";

/** The Rust-generated error object: one variant for each type of `data`. */
type Detail = components["schemas"]["Error"]["error"];

/** The variants whose reasons carry `data`. */
type Carrying = Extract<Detail, { data: unknown }>;

/** A reason whose envelope carries typed `data`. */
export type ApiDataReason = Carrying["reason"];

/**
 * The generated type of the `data` each such reason carries, keyed by the
 * reason, so a renamed or an added field fails to compile where it is read.
 */
export type ApiErrorData = {
  [Variant in Carrying as Variant["reason"]]: Variant["data"];
};

/** `Values` when it names every member of `T`, otherwise `never`. */
type Every<T, Values extends readonly T[]> = [T] extends [Values[number]]
  ? Values
  : never;

const causes = [
  "closed-pull-request",
  "fork-pull-request",
] as const satisfies readonly IneligibleCause[];

/** Every generated cause, checked for missing and extra entries at compile time. */
export const ineligibleCauses: Every<IneligibleCause, typeof causes> = causes;

const planValues = ["free", "team"] as const satisfies readonly Plan[];
const plans: Every<Plan, typeof planValues> = planValues;

const slugFieldValues = ["slug"] as const satisfies readonly SlugField[];
const slugFields: Every<SlugField, typeof slugFieldValues> = slugFieldValues;

/** The envelope's `data` before any of its values is trusted. */
type Fields = Readonly<Record<string, unknown>>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Nonempty text, as every identifier and slug the API sends is. */
function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Whether a value is one this build knows, rather than one it assumes. */
function isOneOf<T>(known: readonly T[], value: unknown): value is T {
  return known.some((item) => item === value);
}

function slugConflict({
  field,
  suggestedSlug,
}: Fields): ApiErrorData["slug-taken"] | undefined {
  return isOneOf(slugFields, field) && isText(suggestedSlug)
    ? { field, suggestedSlug }
    : undefined;
}

/**
 * One parser for each reason that carries data, so a reason the contract adds
 * fails to compile until it has one. A value of another type, such as a cause
 * or a plan this build does not know, drops the reason's data: no screen
 * assumes what it means.
 */
const parsers: {
  [Reason in ApiDataReason]: (data: Fields) => ApiErrorData[Reason] | undefined;
} = {
  "version-conflict": ({ currentVersion }) =>
    typeof currentVersion === "number" && Number.isSafeInteger(currentVersion)
      ? { currentVersion }
      : undefined,
  "duplicate-project": ({ existingProjectId }) =>
    isText(existingProjectId) ? { existingProjectId } : undefined,
  "plan-required": ({ requiredPlan, feature }) =>
    isOneOf(plans, requiredPlan) && isText(feature)
      ? { requiredPlan, feature }
      : undefined,
  "slug-taken": slugConflict,
  "slug-reserved": slugConflict,
  "build-ineligible": ({ cause }) =>
    isOneOf(ineligibleCauses, cause) ? { cause } : undefined,
  "build-already-active": ({ buildId }) =>
    isText(buildId) ? { buildId } : undefined,
  "build-already-published": ({ publicationId }) =>
    isText(publicationId) ? { publicationId } : undefined,
};

/** Every reason that carries data, as the parsers name them. */
export const apiDataReasons: readonly string[] = Object.keys(parsers);

function isDataReason(reason: string): reason is ApiDataReason {
  return apiDataReasons.includes(reason);
}

function parsed<Reason extends ApiDataReason>(
  reason: Reason,
  data: Fields,
): Partial<ApiErrorData> {
  const known: Partial<ApiErrorData> = {};
  const value = parsers[reason](data);
  if (value !== undefined) known[reason] = value;
  return known;
}

/**
 * Read the envelope's `data` for `reason`. The result holds one entry, keyed
 * by `reason`, only when the data has the type the generated contract gives
 * that reason; any other data leaves it empty.
 */
export function parseErrorData(
  reason: string,
  data: unknown,
): Partial<ApiErrorData> {
  return isDataReason(reason) && isFields(data) ? parsed(reason, data) : {};
}
