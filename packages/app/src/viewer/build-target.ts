import { asApiError } from "../api/errors";
import type { Build, Project } from "../api/types";
import type { PublicationRef } from "../data/publications";
import { buildPath, publicationPath } from "../navigation/paths";

/**
 * Where one build request leads: the new build's details, or the build or
 * publication that already answers for the head, because a head that is
 * already publishing or published is somewhere the reader can go rather than
 * a refusal to read. Every other refusal is the caller's to report, and none
 * of them adds a guide beside the control that sent the request.
 */
export async function requestTarget(
  project: Pick<Project, "id" | "workspaceSlug" | "slug">,
  ref: PublicationRef,
  request: (projectId: string, ref: PublicationRef) => Promise<Build>,
): Promise<string> {
  const { workspaceSlug, slug } = project;
  try {
    const build = await request(project.id, ref);
    return buildPath(workspaceSlug, slug, build.id);
  } catch (caught) {
    const error = asApiError(caught);
    const active = error?.dataFor("build-already-active");
    if (active) return buildPath(workspaceSlug, slug, active.buildId);
    const published = error?.dataFor("build-already-published");
    if (published) {
      return publicationPath(workspaceSlug, slug, published.publicationId);
    }
    throw caught;
  }
}
