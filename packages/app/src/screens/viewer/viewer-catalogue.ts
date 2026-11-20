import type { Project, Publication } from "../../api/types";
import { accessOpen, useCatalogueAccess } from "../../viewer/access";
import type { CatalogueAccess } from "../../viewer/access";
import type { HostedCatalogue } from "../../viewer/host";
import type { SourceState } from "../../viewer/source-store";
import { useCatalogueSource } from "../../viewer/use-catalogue-source";

/** What the stage decides on, and what the package mounts once it can. */
export interface ViewerCatalogue {
  access: CatalogueAccess;
  state: SourceState;
  hosted?: HostedCatalogue;
}

/**
 * The ready publication's access exchange and catalogue source. The exchange
 * comes first, so a private catalogue's index and details are read only with
 * a confirmed cookie; a public catalogue skips it and is read without one.
 */
export function useViewerCatalogue(
  project: Project,
  publication: Publication | undefined,
): ViewerCatalogue {
  const credentialed = project.visibility === "private";
  const access = useCatalogueAccess({
    projectId: project.id,
    publicationId: publication?.id ?? "",
    required: credentialed,
    enabled: publication?.state === "ready",
  });
  const origin = publication?.catalogueUrl ?? undefined;
  const { source, state } = useCatalogueSource(
    origin === undefined || publication === undefined
      ? undefined
      : {
          origin,
          credentialed,
          projectId: project.id,
          publicationId: publication.id,
        },
    accessOpen(access.state),
  );
  const read = state.read;
  return {
    access,
    state,
    hosted:
      source !== undefined && read.status === "ready"
        ? { source, index: read.index, detail: read.detail }
        : undefined,
  };
}
