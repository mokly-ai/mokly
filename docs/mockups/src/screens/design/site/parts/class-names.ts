/** Join a part's class names, leaving out the absent ones. */
export function classNames(
  ...names: readonly (string | false | null | undefined)[]
): string {
  return names.filter(Boolean).join(" ");
}
