/** The standalone shell's version failure state, shown in its mount element. */

import { useEffect } from "react";

import { RootState } from "@mokly/ui/shell-layout";

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
    <RootState
      message={VERSION_ERROR_MESSAGE}
      onReload={reload}
      root={{ kind: "standalone" }}
      state="version"
    />
  );
}
