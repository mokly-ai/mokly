import type { Project, Publication } from "../../api/types";
import { useCatalogueAccess } from "../../viewer/access";
import type { CatalogueAccess } from "../../viewer/access";
import type { HostedCatalogue } from "../../viewer/host";
import type { SourceAccess, SourceState } from "../../viewer/source-store";
import { useCatalogueSource } from "../../viewer/use-catalogue-source";

/** What the stage decides on, and what the package mounts once it can. */
export interface ViewerCatalogue {
  access: CatalogueAccess;
  state: SourceState;
  hosted?: HostedCatalogue;
}

/**
 * The ready publication's access exchange and catalogue source. The exchange
 * comes first, so a private catalogue's index and details use the credential
 * that confirmed. A public catalogue opens without credentials.
 */
export function useViewerCatalogue(
  project: Project,
  publication: Publication | undefined,
): ViewerCatalogue {
  const origin = publication?.catalogueUrl ?? undefined;
  const access = useCatalogueAccess({
    projectId: project.id,
    publicationId: publication?.id ?? "",
    origin,
    required: project.visibility === "private",
    enabled: publication?.state === "ready",
  });
  const confirmed = access.state;
  const readAccess: SourceAccess | undefined =
    confirmed.status === "open"
      ? { policy: "public" }
      : confirmed.status === "granted"
        ? confirmed
        : undefined;
  const { source, state } = useCatalogueSource(
    origin === undefined || readAccess === undefined
      ? undefined
      : { origin, access: readAccess },
    readAccess !== undefined,
  );
  const read = state.read;
  return {
    access,
    state,
    hosted:
      source !== undefined && read.status === "ready"
        ? {
            source,
            index: read.index,
            detail: read.detail,
            frameAccess: access.frame,
          }
        : undefined,
  };
}
