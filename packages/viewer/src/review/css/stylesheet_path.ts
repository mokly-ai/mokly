/** Browser-safe stylesheet identity shared by resource discovery and result validation. */
export function isStylesheetPath(path: string): boolean {
  return /\.css$/i.test(path);
}
