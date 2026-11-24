/** Read a guide sample's project-relative source path. */
export function guideSamplePath(info: string): string | undefined {
  const sample = /^html sample=(specs\/[^\s\\]+)$/u.exec(info)?.[1];
  return sample &&
    sample.endsWith(".screen.html") &&
    sample
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
    ? sample
    : undefined;
}
