/** The URL that `scripts/cloud/dev-publication-env.sh` uses when none is set. */
export const DEFAULT_DATABASE_URL =
  "postgres://postgres:postgres@localhost/mkc_test";

/** The port that Postgres listens on when the URL names none. */
const POSTGRES_PORT = 5432;

/**
 * The host and port of the database that `MKC_DATABASE_URL` names, in the form
 * that a TCP connection takes: an IPv6 host has no brackets. The error for a
 * URL that cannot be read names the setting and never the URL, because the URL
 * can hold a password.
 *
 * @param {string} url
 * @returns {{ host: string, port: number }}
 */
export function databaseEndpoint(url) {
  /** @type {URL} */
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      "MKC_DATABASE_URL is not a valid URL. Fix it, or unset it to use the local default.",
    );
  }
  const host = parsed.hostname.replace(/^\[(.*)\]$/, "$1");
  return { host, port: Number(parsed.port || POSTGRES_PORT) };
}
