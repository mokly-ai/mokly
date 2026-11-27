import { DropdownSelector } from "@firna/ui/dropdown";
import { useRouter } from "expo-router";

import type { Workspace } from "../../api/types";
import { iconSize, iconStroke, icons } from "../../components/icons";
import { useCompact } from "../../layout/viewport";
import { follow } from "../../navigation/follow";
import { createWorkspaceForPath } from "../../navigation/paths";

/**
 * The select's last choice, which makes a new workspace for the account rather
 * than naming one. Workspace ids are UUIDs, so this value names none of them.
 */
const createWorkspaceChoice = "create-workspace";

/** The start glyph where a chosen row's check sits, in the row's own colour. */
function StartGlyph({ color }: { color: string }) {
  const Glyph = icons.start;
  return (
    <Glyph
      size={iconSize.row}
      strokeWidth={iconStroke}
      color={color}
      aria-hidden
    />
  );
}

/**
 * The connect situation's Workspace select: the workspaces the reader
 * administers, then Create a workspace as its own last section. Choosing a
 * workspace makes it the account's destination. Create a workspace opens the
 * workspace step, which carries the installation on to the install step with
 * the new workspace named, so the select stands for one workspace too.
 */
export function WorkspaceChoice({
  chosen,
  workspaces,
  installationId,
  readOnly,
  onChoose,
}: {
  chosen: string;
  workspaces: readonly Workspace[];
  installationId: number;
  readOnly: boolean;
  onChoose: (workspaceId: string) => void;
}) {
  const compact = useCompact();
  const router = useRouter();
  return (
    <div className="fo-account-selector">
      <DropdownSelector
        label="Workspace"
        // The trigger carries the chosen workspace, so its composed name would
        // change with the value; naming it once keeps the control the same
        // control however the reader has answered it.
        triggerLabel="Workspace"
        value={chosen}
        options={[]}
        sections={[
          {
            options: workspaces.map((workspace) => ({
              value: workspace.id,
              label: workspace.name,
            })),
          },
          {
            options: [
              {
                value: createWorkspaceChoice,
                label: "Create a workspace",
                right: StartGlyph,
                testID: "create-workspace-choice",
              },
            ],
          },
        ]}
        variant="field"
        size={compact ? "lg" : "md"}
        searchable
        readOnly={readOnly}
        onValueChange={(value) =>
          value === createWorkspaceChoice
            ? follow(createWorkspaceForPath(installationId), router)
            : onChoose(value)
        }
        testID="workspace-select"
      />
    </div>
  );
}
