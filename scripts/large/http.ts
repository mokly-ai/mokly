/** Do not count a failed preview response as usable cached content. */
export async function previewBytes(
  url: URL,
  request: typeof fetch = fetch,
): Promise<number> {
  const response = await request(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Cached preview: HTTP ${response.status}`);
  return (await response.arrayBuffer()).byteLength;
}
