import { isCancellation, MoklyError } from "../errors.js";
import { publishCancelled } from "../publish/errors.js";

/** Map one publish-boundary failure without hiding typed recovery guidance. */
export function publishFailure(error: unknown): MoklyError {
  if (isCancellation(error))
    return error instanceof MoklyError ? error : publishCancelled();
  if (error instanceof MoklyError) return error;
  return new MoklyError(
    "upload-failed",
    "Could not prepare the publication. Check local configuration and temporary storage before retrying.",
  );
}
