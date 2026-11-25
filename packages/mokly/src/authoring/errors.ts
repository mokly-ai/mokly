import { SidecarError, detail } from "../sidecar/errors.js";

export class AuthoringError extends Error {}

/** Keep errors from Mokly's own render-time work fatal in a story. */
export function withAuthoringErrors<T>(body: () => T): T {
  try {
    return body();
  } catch (error) {
    if (error instanceof SidecarError || error instanceof AuthoringError)
      throw error;
    throw new AuthoringError(detail(error), { cause: error });
  }
}
