import { useEffect } from "react";

import type { Project } from "../../api/types";
import { replaceAddress } from "../../navigation/address";
import type { AddressRouter } from "../../navigation/address";
import { publicationPath } from "../../navigation/paths";
import { referenceResolutionHref } from "../../viewer/selection";

import type { ViewerAddressState } from "./address-state";

/**
 * Replace a reference alias with the address of the publication it resolved
 * to.
 *
 * Everything the reader's link named travels to the publication the reference
 * resolved to — the screen, the settings pane, the viewport and scheme —
 * because a reader who opens a link with a dialog named expects the dialog.
 * Only the reference's own key and the router-reserved screen key are left
 * behind; the replacement names a publication and must never turn a query
 * value into navigator state.
 */
export function useReferenceRedirect(
  redirect: string | undefined,
  project: Project,
  router: AddressRouter,
  address: Pick<
    ViewerAddressState,
    "search" | "state" | "defaults" | "corrected"
  >,
): void {
  const { search, state, defaults, corrected } = address;
  useEffect(() => {
    if (!redirect) return;
    const target = publicationPath(
      project.workspaceSlug,
      project.slug,
      redirect,
    );
    replaceAddress(
      router,
      referenceResolutionHref(target, search, state, defaults, corrected),
    );
  }, [
    redirect,
    project.workspaceSlug,
    project.slug,
    router,
    state,
    defaults,
    corrected,
    search,
  ]);
}
