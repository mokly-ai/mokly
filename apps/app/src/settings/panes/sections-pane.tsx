import type { ReactNode } from "react";

import { Action } from "../../components/action";
import { ContentList } from "../../components/controls";
import { Section, StateMessage } from "../../components/page-parts";
import { createWorkspacePath } from "../../navigation/paths";
import { useSettings } from "../context";
import { PaneRows } from "../pane-rows";
import { availablePanes, sections } from "../panes";
import type { PaneDefinition } from "../panes";

/**
 * The index's layout: each section that has a pane in `panes`, over the rows
 * that `rows` draws for its panes. The index and its wait both draw it.
 */
function SectionIndex({
  panes,
  rows,
}: {
  panes: readonly PaneDefinition[];
  rows: (label: string, panes: readonly PaneDefinition[]) => ReactNode;
}) {
  return (
    <div className="fo-stack">
      {sections
        .filter((section) => panes.some((pane) => pane.section === section))
        .map((section) => (
          <Section title={section} key={section}>
            <div className="fo-panel">
              {rows(
                section + " settings",
                panes.filter((pane) => pane.section === section),
              )}
            </div>
          </Section>
        ))}
    </div>
  );
}

/** The settings index: every section it can reach, and the panes under it. */
export function SectionsPane() {
  const { workspace, project, leaveTo } = useSettings();
  const available = availablePanes({
    workspace: Boolean(workspace),
    project: Boolean(project),
    role: workspace?.role,
  });
  if (!workspace) {
    return (
      <StateMessage
        title="Create your first workspace"
        icon="workspace"
        action={
          <Action
            label="Create workspace"
            tone="primary"
            size="md"
            onPress={() => leaveTo(createWorkspacePath)}
          />
        }
      >
        Workspace and project settings appear once you have one.
      </StateMessage>
    );
  }
  return (
    <SectionIndex
      panes={available}
      rows={(label, listed) => <PaneRows label={label} panes={listed} />}
    />
  );
}

/**
 * The index while the settings scope loads: the sections and panes that the
 * scope gives an owner, as the rail beside it draws them. Every pane's name and
 * summary are known, so they stay text; where each row leads waits, because its
 * address needs the scope, so Open is text with no link.
 */
export function SectionsWait({ panes }: { panes: readonly PaneDefinition[] }) {
  return (
    <SectionIndex
      panes={panes}
      rows={(label, listed) => (
        <ContentList
          label={label}
          rows={listed.map((pane) => ({
            id: pane.id,
            title: pane.title,
            detail: pane.summary,
            action: "Open",
            waiting: true,
          }))}
        />
      )}
    />
  );
}
