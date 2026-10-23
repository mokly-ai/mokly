/** The standalone shell's version failure state, shown in its mount element. */

import { useEffect } from "react";

import {
  type MoklyVersionError,
  VERSION_ERROR_MESSAGE,
} from "../catalogue/version_error.js";

/**
 * Present the headline with Reload, which loads the viewer that Serve or the
 * static build ships with its catalogue, and log the diagnostic separately.
 */
export function VersionFailure({
  error,
  reload,
}: {
  error: MoklyVersionError;
  reload(): void;
}) {
  useEffect(() => {
    console.error(VERSION_ERROR_MESSAGE, error.message);
  }, [error]);
  return (
    <div className="mbk mbk-empty" data-mokly-version-error="" role="alert">
      <h2>{VERSION_ERROR_MESSAGE}</h2>
      <button className="mbk-empty-link" onClick={reload} type="button">
        Reload
      </button>
    </div>
  );
}
