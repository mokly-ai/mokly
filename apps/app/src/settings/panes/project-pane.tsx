import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { formFailure } from "../../components/form-failure";
import { publishesFromCi, visibilityLabel } from "../../api/labels";
import type { Project } from "../../api/types";
import { Action } from "../../components/action";
import { Field } from "../../components/field";
import { Facts } from "../../components/page-parts";
import {
  ControlPlaceholder,
  factPlaceholder,
  TextBar,
} from "../../components/placeholders";
import { ToggleWait } from "../../components/toggle";
import { updateProject } from "../../data/projects";
import { canonicalProjectWorkingRoute } from "../../navigation/canonical";
import { projectPath } from "../../navigation/paths";
import { useSettings } from "../context";
import { useDraft } from "../dirty";
import { draftKey } from "../drafts";
import { useWrite } from "../write";
import { AutomaticBuilds, AutomaticBuildsLayout } from "./project-builds";
import { ChangeVisibility } from "./project-visibility";
import { SlugEditor } from "./slug-editor";

/** The widths in px of the pane's controls that the project decides. */
const changeWidth = 72;
const visibilityWidth = 102;
const saveWidth = 123;

/**
 * The Project pane's layout, which the pane and its wait both draw: the name,
 * the project's facts and Save, then its Automatic builds setting.
 */
function ProjectLayout({
  name,
  facts,
  save,
  builds,
  modal,
}: {
  name: ReactNode;
  facts: readonly (readonly [string, ReactNode])[];
  save: ReactNode;
  builds: ReactNode;
  modal?: ReactNode;
}) {
  return (
    <div className="fo-stack">
      <section className="fo-section fo-section-flush">
        <div className="fo-form">
          {name}
          <Facts rows={facts} />
          {save}
        </div>
      </section>
      <section className="fo-section">
        <div className="fo-form">{builds}</div>
      </section>
      {modal}
    </div>
  );
}

/**
 * Name, the immutable repository identity, and visibility, whose change is
 * asked in a modal over the pane, then the Automatic builds setting — or, for
 * a project that cannot build, the one sentence that says how it publishes.
 */
export function ProjectPane({ project }: { project: Project }) {
  const { reload, paneView, openPaneView } = useSettings();
  const [name, setName] = useDraft(
    draftKey("project", project.id, "name"),
    project.name,
  );
  const [confirming, setConfirming] = useState(false);
  const closeVisibility = useCallback(() => setConfirming(false), []);
  const next = project.visibility === "private" ? "public" : "private";
  // Renaming and changing visibility are two writes the reader makes with two
  // controls, so each carries its own state and sends its own fields; the
  // visibility change lives in its own modal for that reason. A name put back
  // the way it was has nothing to send, so its failure goes with it.
  const sendable = name.trim().length > 0 && name.trim() !== project.name;
  const rename = useWrite(reload, sendable);

  const save = useCallback(
    () =>
      rename.run(() =>
        updateProject(project.id, {
          name: name.trim(),
          slug: project.slug,
          visibility: project.visibility,
          requireApproval: project.requireApproval,
          version: project.version,
        }),
      ),
    [
      name,
      project.id,
      project.slug,
      project.visibility,
      project.requireApproval,
      project.version,
      rename,
    ],
  );

  // Only a rejected name belongs on the name field; a permission the reader
  // lacks or a version that moved on is reported beside Save.
  const failure = formFailure(rename, { "validation-failed": "name" });
  if (paneView?.id === "slug" && paneView.pane === "project") {
    return (
      <SlugEditor
        subject="project"
        subjectId={project.id}
        current={project.slug}
        address={(slug) => projectPath(project.workspaceSlug, slug)}
        save={(slug) =>
          updateProject(project.id, {
            name: project.name,
            slug,
            visibility: project.visibility,
            requireApproval: project.requireApproval,
            version: project.version,
          })
        }
        canonicalAddress={(pathname, search, saved) =>
          canonicalProjectWorkingRoute(
            pathname,
            search,
            project.workspaceSlug,
            project.slug,
            saved.workspaceSlug ?? project.workspaceSlug,
            saved.slug,
          )
        }
      />
    );
  }
  return (
    <ProjectLayout
      name={
        <Field
          label="Project name"
          name="project-name"
          type="text"
          value={name}
          onChange={setName}
          disabled={rename.working || !project.canAdmin}
          error={failure.on("name")}
        />
      }
      facts={[
        [
          "Slug",
          <span className="review-inline" key="project-slug">
            <code>{project.slug}</code>
            {project.canAdmin && (
              <Action
                label="Change"
                tone="quiet"
                size="sm"
                onPress={() =>
                  openPaneView({
                    id: "slug",
                    pane: "project",
                    title: "Project address",
                  })
                }
                testID="change-project-slug"
              />
            )}
          </span>,
        ],
        ["Repository", project.repository],
        ["Config", <code key="config">{project.configPath}</code>],
        [
          "Visibility",
          <span className="fo-fact-action" key="visibility">
            {visibilityLabel(project.visibility)}
            {project.canAdmin && (
              <Action
                label={next === "public" ? "Make public" : "Make private"}
                tone="quiet"
                size="sm"
                onPress={() => setConfirming(true)}
                testID="change-visibility"
              />
            )}
          </span>,
        ],
      ]}
      save={
        project.canAdmin &&
        failure.around(
          <div>
            <Action
              label={failure.label("Save changes", "Saving…")}
              tone="primary"
              size="md"
              write={rename}
              operation="Saving settings"
              disabled={rename.disabled}
              onPress={() => void save()}
              testID="save-project"
            />
          </div>,
        )
      }
      builds={
        project.buildsAvailable ? (
          <AutomaticBuilds project={project} />
        ) : (
          <p className="fo-copy">{publishesFromCi}</p>
        )
      }
      modal={
        confirming && (
          <ChangeVisibility
            project={project}
            onClose={closeVisibility}
            onChanged={reload}
          />
        )
      }
    />
  );
}

/**
 * The pane while the settings scope loads. Every text that the project
 * supplies waits as a bar in its own line box, and the field waits in its
 * frame. Change, the visibility change and Save show for the readers who
 * administer the project, the most common form, as placeholders in their own
 * boxes, and so does the Automatic builds switch, whose value the project
 * decides.
 */
export function ProjectWait() {
  return (
    <ProjectLayout
      name={
        <Field label="Project name" name="project-name" type="text" waiting />
      }
      facts={[
        [
          "Slug",
          <span className="review-inline" key="project-slug">
            <code>
              <TextBar width="7em" />
            </code>
            <ControlPlaceholder size="sm" width={changeWidth} />
          </span>,
        ],
        factPlaceholder("Repository", "11em"),
        [
          "Config",
          <code key="config">
            <TextBar width="9em" />
          </code>,
        ],
        [
          "Visibility",
          <span className="fo-fact-action" key="visibility">
            <TextBar width="3.5em" />
            <ControlPlaceholder size="sm" width={visibilityWidth} />
          </span>,
        ],
      ]}
      save={
        <div>
          <ControlPlaceholder size="md" width={saveWidth} />
        </div>
      }
      builds={
        <AutomaticBuildsLayout
          control={<ToggleWait label="Automatic builds" />}
        />
      }
    />
  );
}
