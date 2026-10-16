import { decode, object, portable, controls, size, unicode } from "./json.js";

const timestamp = (value: unknown): boolean =>
  typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const text = (value: unknown, max: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  size(value) <= max &&
  unicode(value) &&
  !controls(value);
const hex = (value: unknown) =>
  typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value);
function version(value: string): boolean {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/u.exec(
      value,
    );
  return (
    !!match &&
    [match[4], match[5]].every(
      (part) =>
        part === undefined ||
        part
          .split(".")
          .every((identifier) => /^[0-9A-Za-z-]+$/u.test(identifier)),
    ) &&
    (match[4] === undefined ||
      match[4]
        .split(".")
        .every(
          (identifier) =>
            !/^\d+$/u.test(identifier) || /^(0|[1-9]\d*)$/u.test(identifier),
        ))
  );
}
export function upload(bytes: Uint8Array): Record<string, unknown> {
  if (bytes.length > 16_384) throw new Error("too-large");
  const value = object(decode(bytes));
  if (!("schemaVersion" in value)) throw new Error("invalid");
  if (value.schemaVersion !== 2) throw new Error("unsupported-version");
  const keys = [
    "schemaVersion",
    "moklyVersion",
    "repository",
    "branch",
    "headSha",
    "baseRef",
    "baseSha",
    "pullRequest",
    "configPath",
    "exportedAt",
    "comparisonPath",
  ].sort();
  if (Object.keys(value).sort().join() !== keys.join())
    throw new Error("invalid");
  if (!text(value.moklyVersion, 255) || !version(String(value.moklyVersion)))
    throw new Error("invalid");
  const repository = object(value.repository);
  if (
    Object.keys(repository).sort().join() !== "host,name,owner" ||
    !text(repository.host, 253) ||
    !String(repository.host)
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
  )
    throw new Error("invalid");
  for (const [key, nested] of [
    ["owner", true],
    ["name", false],
  ] as const) {
    const item = repository[key];
    if (
      !text(item, 255) ||
      typeof item !== "string" ||
      (!nested && item.includes("/")) ||
      !item
        .split("/")
        .every(
          (part) =>
            /^[A-Za-z0-9_.-]+$/u.test(part) && part !== "." && part !== "..",
        )
    )
      throw new Error("invalid");
  }
  if (
    !text(value.branch, 255) ||
    !hex(value.headSha) ||
    typeof value.configPath !== "string" ||
    !portable(value.configPath) ||
    size(value.configPath) > 1024 ||
    !timestamp(value.exportedAt)
  )
    throw new Error("invalid");
  if (
    value.pullRequest !== null &&
    (!Number.isSafeInteger(value.pullRequest) || Number(value.pullRequest) <= 0)
  )
    throw new Error("invalid");
  if (value.comparisonPath === null) {
    if (value.baseRef !== null || value.baseSha !== null)
      throw new Error("invalid");
  } else if (
    !text(value.baseRef, 255) ||
    !hex(value.baseSha) ||
    typeof value.comparisonPath !== "string" ||
    !/^mokly-viewer\/diffs\/generations\/[a-f0-9]{64}\/review\.json$/u.test(
      value.comparisonPath,
    )
  )
    throw new Error("invalid");
  return value;
}
function requestUrl(value: string, endpoint: string): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== new URL(endpoint).origin ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("invalid");
  return url;
}
export function plan(
  bytes: Uint8Array,
  endpoint: string,
  marker: string[],
  status = 200,
  contentType: string | null = "application/json",
) {
  if (
    status !== 200 ||
    bytes.length > 16_777_216 ||
    contentType?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  )
    throw new Error("invalid");
  const root = object(decode(bytes));
  const session = object(root.upload);
  if (
    root.schemaVersion !== 1 ||
    !text(session.id, 255) ||
    !timestamp(session.expiresAt) ||
    !Array.isArray(root.missing)
  )
    throw new Error("invalid");
  let previous = "";
  for (const item of root.missing) {
    if (
      typeof item !== "string" ||
      !/^[a-f0-9]{64}$/u.test(item) ||
      item <= previous ||
      !marker.includes(item)
    )
      throw new Error("invalid");
    previous = item;
  }
  if (typeof root.blobUrl !== "string" || typeof root.completeUrl !== "string")
    throw new Error("invalid");
  if (
    root.blobUrl.split("{sha256}").length !== 2 ||
    !root.blobUrl.split(/[?#]/u)[0]?.includes("{sha256}")
  )
    throw new Error("invalid");
  const probe = "0".repeat(64);
  if (
    !requestUrl(
      root.blobUrl.replace("{sha256}", probe),
      endpoint,
    ).pathname.includes(probe)
  )
    throw new Error("invalid");
  requestUrl(root.completeUrl, endpoint);
}
export function complete(
  bytes: Uint8Array,
  status: number,
  contentType: string | null,
) {
  const rejected: Record<number, string> = {
    400: "upload-invalid-bundle",
    422: "upload-invalid-bundle",
    413: "upload-too-large",
    401: "upload-unauthorized",
    403: "upload-unauthorized",
    426: "upload-unsupported-version",
    409: "replan",
    410: "replan",
  };
  if (status !== 200 && status !== 201)
    return {
      outcome:
        rejected[status] ??
        ([408, 429, 500, 502, 503, 504].includes(status)
          ? "retry"
          : "upload-failed"),
      viewerUrl: null,
    };
  let viewerUrl: string | null = null;
  try {
    if (
      contentType?.split(";")[0]?.trim().toLowerCase() === "application/json" &&
      bytes.length <= 16_777_216
    ) {
      const url = new URL(String(object(decode(bytes)).viewerUrl));
      if (["http:", "https:"].includes(url.protocol)) viewerUrl = url.href;
    }
  } catch {
    /* A known completion succeeds independently of optional body data. */
  }
  return {
    outcome: status === 201 ? "published" : "already-published",
    viewerUrl,
  };
}
