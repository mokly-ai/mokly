/** Keep Node referenced until one complete CLI command action settles. */
export async function withCommandKeepAlive<Result>(
  action: () => Promise<Result>,
): Promise<Result> {
  const handle = setInterval(() => undefined, 2 ** 31 - 1);
  try {
    return await action();
  } finally {
    clearInterval(handle);
  }
}
