/**
 * A GitHub installation id as an address carries it: a positive base-10
 * integer that a JavaScript number holds exactly. Anything else is not an id,
 * so a route that reads one treats it as absent rather than guessing.
 */
export function parseInstallationId(
  value: string | undefined,
): number | undefined {
  if (value === undefined || !/^[1-9][0-9]*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}
