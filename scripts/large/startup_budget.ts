import type { Variant } from "../../tests/fixtures/large/dimensions.js";

/** The opt-in benchmark enforces the approved browser-visible startup budget. */
export function startupBudget(
  usableMs: number,
  variant: Variant,
): string | undefined {
  const limit = { html: 5000, react: 15000 }[variant];
  return Number.isFinite(usableMs) && usableMs >= 0 && usableMs < limit
    ? undefined
    : `Usable startup for ${variant} must be under ${limit} ms; observed ${usableMs} ms`;
}
