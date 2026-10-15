import type { RemoteCode } from "../generated/sidecar/RemoteCode.js";

export class SidecarError extends Error {
  constructor(
    readonly code: RemoteCode,
    message: string,
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
