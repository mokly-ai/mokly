/** Count LF-delimited physical lines after normalizing CRLF input. */
export function countPhysicalLines(value) {
  const source = Buffer.isBuffer(value) ? value.toString("utf8") : value;
  const normalized = source.replaceAll("\r\n", "\n");
  if (normalized.length === 0) return 0;
  const separators = normalized.split("\n").length - 1;
  return separators + (normalized.endsWith("\n") ? 0 : 1);
}

/** Whether a repository path names an audited JavaScript or TypeScript module. */
export function isSourceModulePath(file) {
  return /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u.test(file);
}
