/** Copy a static site and add host headers without changing its installed bytes. */
export function prepareHosting(
  source: string,
  destination: string,
): Promise<void>;
