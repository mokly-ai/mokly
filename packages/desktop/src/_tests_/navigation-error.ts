/** Match Electron's credential-bearing load rejection without printing it. */
export function navigationError(url: string): Error {
  return Object.assign(
    new Error(`ERR_ABORTED loading ${url}`, { cause: { url } }),
    {
      code: "ERR_ABORTED",
      url,
      stack: `Error in ${url}`,
    },
  );
}
