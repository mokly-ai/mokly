/**
 * The count wording of the package's panels: a number and its noun, which
 * takes the singular for one, such as "1 instance" and "3 instances".
 */

/** A count and its noun, in the singular for one and the plural otherwise. */
export function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}
