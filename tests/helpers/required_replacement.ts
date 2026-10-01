/** Replace fixture text and reject stale patterns instead of silently drifting. */
export function replaceRequired(
  source: string,
  target: string | RegExp,
  replacement: string,
  label: string,
): string {
  const replaced = source.replace(target, replacement);
  if (replaced === source)
    throw new Error(
      `[mokly/test-fixture] ${label} replacement did not change the source; target was absent: ${String(target)}`,
    );
  return replaced;
}
