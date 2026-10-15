/** The standalone shell's version failure state, shown in its mount element. */

import { useEffect } from "react";

import {
  type MoklyVersionError,
  VERSION_ERROR_MESSAGE,
} from "../catalogue/version_error.js";

/** Present the product message and log the typed diagnostic separately. */
export function VersionFailure({ error }: { error: MoklyVersionError }) {
  useEffect(() => {
    console.error(VERSION_ERROR_MESSAGE, error.message);
  }, [error]);
  return (
    <div className="mbk mbk-empty" data-mokly-version-error="" role="alert">
      <p>{VERSION_ERROR_MESSAGE}</p>
    </div>
  );
}
