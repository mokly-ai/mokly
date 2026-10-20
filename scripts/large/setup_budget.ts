/** Approved isolated setup budgets exclude the prerequisite product build. */
export function setupBudget(
  setupMs: number,
  peakKiB: number,
): string | undefined {
  const failures: string[] = [];
  if (!Number.isFinite(setupMs) || setupMs < 0 || setupMs >= 60_000)
    failures.push(
      `Isolated setup must be under 60000 ms. Observed ${setupMs} ms`,
    );
  if (!Number.isFinite(peakKiB) || peakKiB < 0 || peakKiB >= 1.5 * 1024 * 1024)
    failures.push(
      `Setup-family RSS must be under 1.5 GiB (1572864 KiB). Observed ${peakKiB} KiB`,
    );
  return failures.length ? failures.join(". ") : undefined;
}
