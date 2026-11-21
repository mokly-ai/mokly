/** The shared URL and Share syntax for the API's bounded entry path. */
export function isScreenPath(value: string): boolean {
  const segments = value.split("/");
  return (
    value.length <= 2048 &&
    /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(value) &&
    segments[0].toLowerCase() !== "mokly-generated" &&
    segments.every(
      (segment) => !/^(aux|con|nul|prn|com[1-9]|lpt[1-9])$/i.test(segment),
    )
  );
}
