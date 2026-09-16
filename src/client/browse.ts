/** Standalone Serve/export host for the framework-neutral viewer runtime. */
import {
  initializeBrowseShell,
  installViewerServices,
} from "@mokly/viewer/runtime";

import {
  requestComponentPreview,
  componentPreviewExpired,
} from "./control_transport.js";
import { workspaceLoader } from "./workspace_loading.js";

if (typeof document !== "undefined" && typeof window !== "undefined") {
  if (!document.documentElement.hasAttribute("data-mokly-static"))
    installViewerServices(document, {
      requestComponentPreview,
      componentPreviewExpired,
      workspaceLoader,
    });
  initializeBrowseShell(document, window);
}
