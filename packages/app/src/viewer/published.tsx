import type { ReactNode } from "react";

import type { ViewerHostProps } from "./host";

/**
 * A guard for non-web bundles. Native products host the web viewer route in a
 * WebView; they never mount the DOM-only package in a React Native tree.
 */
export const ViewerHost: (props: ViewerHostProps) => ReactNode = () => {
  throw new Error("Native viewer surfaces must host the web viewer route.");
};
