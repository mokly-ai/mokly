import type { PostcssFailure } from "../generated/sidecar/PostcssFailure.js";
import type { RemoteCode } from "../generated/sidecar/RemoteCode.js";

export class SidecarError extends Error {
  constructor(
    readonly code: RemoteCode,
    message: string,
    readonly postcss?: PostcssFailure,
  ) {
    super(message);
  }
}

export function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function protocol(message: string): never {
  throw new SidecarError("sidecar-protocol", message);
}

/** Handles split at the final separator because a module path can contain #. */
export function handleLocation(handle: string): string {
  const separator = handle.lastIndexOf("#");
  return separator < 0
    ? handle
    : `${handle.slice(0, separator)} export ${handle.slice(separator + 1)}`;
}
