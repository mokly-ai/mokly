import { ToastProvider } from "@firna/ui/toast";
import { Slot } from "expo-router";

import { ResourceInvalidationProvider } from "../src/data/resource-invalidation";
import { useCoveredDragAreas } from "../src/layout/covered-drag-areas";
import { SessionProvider } from "../src/session/context";
import { SettingsDialogHost } from "../src/settings/dialog-host";
import { DirtyProvider } from "../src/settings/dirty";
import { AppTheme } from "../src/theme/provider";
import { CatalogueSourceProvider } from "../src/viewer/source-provider";

/**
 * The application's one document frame: the shared theme, the session and the
 * toast stack a completed action reports itself through. Settings stays
 * mounted beside the active route so its desktop dialog can cover any product
 * screen and unsaved state survives presentation changes. The one check of the
 * Mac window's drag areas runs here, so it covers every screen.
 */
export default function RootLayout() {
  useCoveredDragAreas();
  return (
    <AppTheme>
      <ToastProvider placement="bottom-center">
        <SessionProvider>
          <ResourceInvalidationProvider>
            <DirtyProvider>
              <CatalogueSourceProvider>
                <Slot />
                <SettingsDialogHost />
              </CatalogueSourceProvider>
            </DirtyProvider>
          </ResourceInvalidationProvider>
        </SessionProvider>
      </ToastProvider>
    </AppTheme>
  );
}
