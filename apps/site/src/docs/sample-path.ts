/** Read the one metadata word allowed on an HTML sample fence. */
export function samplePath(meta: string): string | undefined {
  const sample = /^sample=(specs\/[^\s\\]+)$/u.exec(meta)?.[1];
  return sample &&
    sample.endsWith(".screen.html") &&
    sample
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
    ? sample
    : undefined;
}
