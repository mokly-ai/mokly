import { useCallback, useEffect, useRef, useState } from "react";

import { asApiError, unexpectedError } from "../api/errors";
import { useCompact } from "../layout/viewport";
import { useSession } from "../session/context";
import { keepSignOutFailure } from "../session/sign-out-failure";
import type { SurfaceId } from "../settings/panes";

import type { AccountActions } from "./account-menu";

/**
 * The bar's two menus: More on the compact bar and the account menu under the
 * full bar's avatar. Their state lives above both the fallback and the package
 * slot trees, so an open menu survives the handoff between them instead of
 * opening on a node that is discarded a frame later. A change of composition
 * closes the menu whose trigger the bar no longer draws. On a touch viewport
 * More opens as a sheet over the viewer, as a panel does, so it is a `sheet`
 * while no overlay owns the screen.
 */
export function useViewerMenus(compactBar: boolean, overlaid: boolean) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const touch = useCompact();
  useEffect(() => {
    if (compactBar) setAccountOpen(false);
    else setMoreOpen(false);
  }, [compactBar]);
  const closeMenus = useCallback(() => {
    setMoreOpen(false);
    setAccountOpen(false);
  }, []);
  return {
    closeMenus,
    sheet: moreOpen && touch && !overlaid,
    /** Whether each menu is open, and the way to open or close it. */
    slots: {
      moreOpen,
      accountOpen,
      onMoreOpen: setMoreOpen,
      onAccountOpen: setAccountOpen,
    },
  };
}

/**
 * Sign out from a menu, which has closed: end the session, and where that
 * fails, keep the failure for the Account pane and call `onFailure`, which
 * opens that pane, so the reader sees why and can try again. A press while a
 * sign-out is in flight sends nothing, and a failure that arrives after the
 * viewer has gone opens nothing.
 */
function useMenuSignOut(onFailure: () => void): () => void {
  const { signOut } = useSession();
  const failed = useRef(onFailure);
  failed.current = onFailure;
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    signOut()
      .catch((caught: unknown) => {
        if (!mounted.current) return;
        keepSignOutFailure(asApiError(caught) ?? unexpectedError());
        failed.current();
      })
      .finally(() => {
        pending.current = false;
      });
  }, [signOut]);
}

/**
 * What the account rows' items do, in the account menu and in More. Each one
 * closes the menu first. Settings opens the settings dialog on its index, and
 * a failed sign-out opens it on the Account pane, which shows the failure.
 * `openSettings` opens the dialog under the account's name, so the dialog
 * returns focus to the avatar, or to More while the compact bar groups the
 * account rows.
 */
export function useAccountActions(
  closeMenus: () => void,
  openSettings: (pane: SurfaceId) => void,
): AccountActions {
  const signOut = useMenuSignOut(() => openSettings("account"));
  return {
    onSettings: () => openSettings("sections"),
    onSignOut: () => {
      closeMenus();
      signOut();
    },
    onLeave: closeMenus,
  };
}
