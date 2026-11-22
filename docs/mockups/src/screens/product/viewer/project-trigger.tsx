import { Action } from "../page-parts";

/** The drawing of the projects panel, which the project trigger opens. */
export const projectsPath = "product/viewer/projects";

/**
 * The workspace and project switcher of the full bar, which the fallback bar
 * and the published slots share: the quiet registered Button labelled with
 * the project, with the workspace as its muted lead and the switcher's
 * chevron. The whole control is one Button, so a press anywhere on it opens
 * the projects. The whole `workspace / project` is its accessible name and
 * the wrapper's tooltip. On a narrow bar the workspace gives up its width
 * before the project gives up any, and each is cut on one line.
 */
export function ProjectTrigger({
  workspace,
  project,
  to,
}: {
  /** The workspace's display name, or its address while that read waits. */
  workspace: string;
  project: string;
  /** The catalogue entry the trigger opens. A published slot opens none. */
  to?: string;
}) {
  const whole = workspace + " / " + project;
  return (
    <span className="fo-top-variable-control" title={whole}>
      <Action
        instance="viewer-project"
        label={project}
        lead={workspace}
        whole={whole}
        tone="quiet"
        size="sm"
        chevron
        block
        singleLine
        to={to}
      />
    </span>
  );
}
