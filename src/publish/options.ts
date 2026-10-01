import { invalidPublishOption } from "./errors.js";
import type { UploadOptions } from "./types.js";

/** Validate transport options before loading consumer code or writing output. */
export function resolvePublishOptions(
  options: Partial<UploadOptions>,
  env: Readonly<Record<string, string | undefined>>,
): UploadOptions {
  const endpoint = options.endpoint ?? env["MOKLY_ENDPOINT"];
  const token = options.token ?? env["MOKLY_TOKEN"];
  try {
    const url = new URL(endpoint ?? "");
    if (
      !endpoint ||
      endpoint.trim() !== endpoint ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash ||
      endpoint.includes("#")
    )
      throw new Error();
  } catch {
    throw invalidPublishOption(
      "Provide --endpoint or MOKLY_ENDPOINT as an absolute HTTP(S) URL without credentials or a fragment.",
    );
  }
  if (!token || !/^[A-Za-z0-9._~+/-]+=*$/.test(token))
    throw invalidPublishOption(
      "Provide --token or MOKLY_TOKEN as a nonempty bearer token.",
    );
  return { endpoint: endpoint!, token };
}
