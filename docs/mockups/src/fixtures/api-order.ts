/**
 * The string order of the API lists that the viewer fixtures stand in for.
 * The viewer read model sorts branch names and screen paths bytewise, so no
 * host locale changes the order of a drawn list.
 */

/** One character's code point. */
function codePoint(character: string): number {
  return character.codePointAt(0) ?? 0;
}

/**
 * Compares two strings by their UTF-8 bytes. UTF-8 keeps the order of code
 * points, so comparing code points gives the bytewise order without an
 * encoder. A string sorts before every longer string that it starts.
 */
export function compareBytewise(left: string, right: string): number {
  const leftPoints = Array.from(left, codePoint);
  const rightPoints = Array.from(right, codePoint);
  const shared = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < shared; index += 1) {
    const difference = leftPoints[index] - rightPoints[index];
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}
