/** The opt-in benchmark enforces the approved browser-visible startup budget. */
export function startupBudget(usableMs: number): string | undefined {
  return Number.isFinite(usableMs) && usableMs >= 0 && usableMs < 5000
    ? undefined
    : `Usable startup must be under 5000 ms; observed ${usableMs} ms`;
}
