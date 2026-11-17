import { ToastProvider } from "@firna/ui/toast";
import { Slot } from "expo-router";

import { SessionProvider } from "../src/session/context";
import { ResourceInvalidationProvider } from "../src/data/resource-invalidation";
import { SettingsDialogHost } from "../src/settings/dialog-host";
import { DirtyProvider } from "../src/settings/dirty";
import { AppTheme } from "../src/theme/provider";
import { CatalogueSourceProvider } from "../src/viewer/source-provider";

/**
 * The application's one document frame: the shared theme, the session and the
 * toast stack a completed action reports itself through. Settings stays
 * mounted beside the active route so its desktop dialog can cover any product
 * screen and unsaved state survives presentation changes.
 */
export default function RootLayout() {
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
