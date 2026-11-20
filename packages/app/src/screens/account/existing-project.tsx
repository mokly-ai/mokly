import type { ApiError } from "../../api/errors";
import { AppLink } from "../../components/app-link";
import { projectPermalinkPath } from "../../navigation/paths";

/**
 * A repository that already has a project, refused with the way to that
 * project. The same request cannot be made to succeed, so the way on is the
 * project that exists rather than another attempt, and the control that sent
 * the request keeps its own label beneath this line.
 */
export function ExistingProject({ error }: { error: ApiError | undefined }) {
  const existing = error?.dataFor("duplicate-project")?.existingProjectId;
  if (!existing) return null;
  return (
    <p className="fo-copy" role="alert">
      This repository already has a project.{" "}
      <AppLink href={projectPermalinkPath(String(existing))}>Open it</AppLink>.
    </p>
  );
}
