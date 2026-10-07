import { CacheError } from "./errors.js";

export type Principal = "trusted-writer" | "pr-writer" | "reader";

export interface CacheBindings {
  TURBO_CACHE_TEAM?: string;
  TURBO_CACHE_TRUSTED_WRITE_TOKEN?: string;
  TURBO_CACHE_PR_WRITE_TOKEN?: string;
  TURBO_CACHE_READ_TOKEN?: string;
}

export interface CacheAccess {
  principal: Principal;
  namespace: string;
  readNamespaces: readonly string[];
}

const principals = ["trusted-writer", "pr-writer", "reader"] as const;
const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

function sameDigest(left: Uint8Array, right: Uint8Array): boolean {
  let difference = 0;
  for (let index = 0; index < 32; index++)
    difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

/** Check every configured secret before choosing a principal or returning an error. */
export async function authenticate(
  request: Request,
  bindings: CacheBindings,
  warn: (message: string) => void,
): Promise<{ principal: Principal; team: string }> {
  const secrets = [
    bindings.TURBO_CACHE_TRUSTED_WRITE_TOKEN ?? "",
    bindings.TURBO_CACHE_PR_WRITE_TOKEN ?? "",
    bindings.TURBO_CACHE_READ_TOKEN ?? "",
  ];
  const supplied = /^Bearer ([^\s,]+)$/u.exec(
    request.headers.get("Authorization") ?? "",
  )?.[1];
  const [bearer, ...hashes] = await Promise.all([
    digest(supplied ?? ""),
    ...secrets.map(digest),
  ]);
  let principal: Principal | undefined;
  let duplicate = false;
  for (let index = 0; index < secrets.length; index++) {
    const secret = secrets[index]!;
    const matches = sameDigest(bearer!, hashes[index]!);
    const enabled = encoder.encode(secret).byteLength >= 32;
    if (secret && !enabled)
      warn(
        `Cache principal ${principals[index]} disabled: token is shorter than 32 bytes.`,
      );
    if (matches && enabled && supplied !== undefined)
      principal = principals[index];
    for (let other = index + 1; other < secrets.length; other++)
      duplicate =
        (sameDigest(hashes[index]!, hashes[other]!) &&
          secret !== "" &&
          secrets[other] !== "") ||
        duplicate;
  }
  const team = bindings.TURBO_CACHE_TEAM ?? "";
  const failures: string[] = [];
  if (duplicate) failures.push("duplicate configured secrets");
  if (team === "") failures.push("missing TURBO_CACHE_TEAM");
  else if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(team))
    failures.push("invalid TURBO_CACHE_TEAM");
  if (failures.length > 0)
    throw new CacheError(
      500,
      "configuration_error",
      "Cache configuration is invalid.",
      `Cache configuration failed: ${failures.join("; ")}.`,
    );
  if (!principal)
    throw new CacheError(401, "unauthorized", "Cache authentication required.");
  return { principal, team };
}

export function authorize(
  url: URL,
  principal: Principal,
  team: string,
): CacheAccess {
  const slugs = url.searchParams.getAll("slug");
  const ids = url.searchParams.getAll("teamId");
  const namespace = slugs[0] ?? ids[0] ?? "";
  const sameNamespace = [...slugs, ...ids].every(
    (value) => value === namespace,
  );
  const suffix = namespace.startsWith(`${team}-pr-`)
    ? namespace.slice(team.length + 4)
    : "";
  const allowed =
    principal === "pr-writer"
      ? /^[1-9][0-9]{0,19}$/u.test(suffix)
      : namespace === team;
  if (
    slugs.length > 1 ||
    ids.length > 1 ||
    !sameNamespace ||
    !allowed ||
    namespace === ""
  )
    throw new CacheError(403, "forbidden", "Cache namespace access denied.");
  return {
    principal,
    namespace,
    readNamespaces: principal === "pr-writer" ? [namespace, team] : [team],
  };
}
