/** The shell's state preparation and notifications for one data controller. */

import type { MoklyVersionError } from "../catalogue/version_error.js";

import type { ShellDataSnapshot } from "./data_commit.js";
import type { ShellRoute } from "./routes.js";

/** What the controller asks of the shell that owns it. */
export interface ShellDataHost {
  /** Prepare only viewer-owned state. Return the commit that publishes it. */
  prepare(next: ShellDataSnapshot): () => void;
  /** The route on screen now. */
  route(): ShellRoute;
  versionError(error: MoklyVersionError): void;
  /** A browser warning: live editing or live updates are unavailable. */
  warn(message: string, cause?: unknown): void;
}
