/** Format both selected failure groups, preserving reporter order and counts. */
export function selectedFailureGroups(result) {
  const lines = [];
  for (const [status, names, count] of [
    ["failed", result.failedNames, result.failed],
    ["cancelled", result.cancelledNames, result.cancelled],
  ]) {
    const total = names.length || count;
    if (total === 0) continue;
    lines.push(
      `${total} selected unit test${total === 1 ? "" : "s"} ${status}:`,
    );
    lines.push(...names.slice(0, 20).map((name) => "✖ " + name));
    if (names.length > 20) lines.push("… and " + (names.length - 20) + " more");
  }
  return lines.join("\n");
}
