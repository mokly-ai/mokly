import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { Project } from "../../api/types";
import { PendingName } from "../../components/pending-name";
import { Toggle } from "../../components/toggle";
import { updateProject } from "../../data/projects";
import { useSettings } from "../context";
import { alwaysSendable, useWrite } from "../write";

/**
 * The setting's layout, which the switch and its wait both draw: the switch's
 * row, then the sentence that says what it does.
 */
export function AutomaticBuildsLayout({ control }: { control: ReactNode }) {
  return (
    <div className="fo-setting">
      {control}
      <p className="fo-copy">
        Publish each push to the default branch and to pull requests.
      </p>
    </div>
  );
}

/**
 * Whether pushes publish themselves. The switch writes the setting on its
 * own, without the pane's Save, and sends the project's current fields beside
 * it, because the update is a full one. Only an administrator changes it, and
 * everyone else reads where it stands.
 *
 * While its write runs, the switch shows the value the reader asked for,
 * disabled, with "Saving…" in its own row beside its label, because a switch
 * has no working word of its own; a screen reader hears the operation, and
 * nothing is inserted. A refusal is reported beside the switch.
 */
export function AutomaticBuilds({ project }: { project: Project }) {
  const { reload } = useSettings();
  const write = useWrite(reload, alwaysSendable);
  const [asked, setAsked] = useState(project.automaticBuilds);
  const change = useCallback(
    (next: boolean) => {
      setAsked(next);
      void write.run(() =>
        updateProject(project.id, {
          name: project.name,
          slug: project.slug,
          visibility: project.visibility,
          requireApproval: project.requireApproval,
          version: project.version,
          automaticBuilds: next,
        }),
      );
    },
    [project, write],
  );
  return (
    <AutomaticBuildsLayout
      control={
        <>
          {write.around(
            <Toggle
              label="Automatic builds"
              value={write.working ? asked : project.automaticBuilds}
              disabled={!project.canAdmin || !write.sendable}
              working={write.working ? "Saving…" : undefined}
              onChange={change}
              testID="automatic-builds"
            />,
          )}
          {write.working && (
            <PendingName label="Saving automatic builds" hidden />
          )}
        </>
      }
    />
  );
}
