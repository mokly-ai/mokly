import { decode, object, size } from "./json.js";

const timestamp = (value: unknown): boolean =>
  typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
function requestUrl(value: string, endpoint: string): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== new URL(endpoint).origin ||
    url.username ||
    url.password
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
    typeof session.id !== "string" ||
    session.id.length === 0 ||
    size(session.id) > 255 ||
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
