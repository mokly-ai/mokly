/** Compare paths by UTF-16 code units, independent of the process locale. */
export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
