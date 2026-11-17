import type { Viewport } from "@mokly/mokly";

import { sample } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import { billing } from "../../../fixtures/product-states";
import { Pending } from "../page-parts";

import { AutomaticBuilds } from "./project-builds";
import { ProjectForm } from "./project-form";
import { VisibilityModal } from "./project-visibility";
import type { Visibility } from "./project-visibility";
import { SettingsSurface } from "./surface";

/**
 * The pane's layout, which its loaded drawings and its waits all draw: the
 * name with the project's facts and Save, then its Automatic builds setting,
 * and the visibility question when the pane asked it over itself.
 */
function ProjectPane({
  state,
  viewport,
  changing,
  planRefused = false,
  role = "owner",
  builds = true,
  buildsSaving = false,
  scopeLoading = false,
  screen,
}: {
  state: ScreenState;
  viewport: Viewport;
  /** The visibility change's own write is running, towards this visibility. */
  changing?: Visibility;
  /** The project is public and the plan refuses to make it private. */
  planRefused?: boolean;
  /** Who is reading a refusal: only an owner is offered the way to Billing. */
  role?: "owner" | "admin";
  /** Whether the project can build, which decides what its setting draws. */
  builds?: boolean;
  /** The Automatic builds switch's own write is running. */
  buildsSaving?: boolean;
  /** The pane was asked for by its address while the settings scope loads. */
  scopeLoading?: boolean;
  screen?: string;
}) {
  // A project that is being made private, or that the plan refused to make
  // private, is public now.
  const visibility =
    planRefused || changing === "private"
      ? billing.publicVisibility
      : sample.visibility;
  const visibilityScreen = planRefused
    ? role === "owner"
      ? "product/settings/project/visibility/plan"
      : "product/settings/project/visibility/plan-admin"
    : changing === "private"
      ? "product/settings/project/visibility/private"
      : "product/settings/project/visibility";
  const layout = (
    <div className="fo-stack">
      <ProjectForm
        state={state}
        scopeLoading={scopeLoading}
        visibility={visibility}
        visibilityScreen={visibilityScreen}
      />
      <section className="fo-section">
        <div className="fo-form">
          <AutomaticBuilds
            available={builds}
            saving={buildsSaving}
            waiting={scopeLoading}
          />
        </div>
      </section>
    </div>
  );
  return (
    <SettingsSurface
      pane="project"
      state={state}
      screen={screen}
      modal={
        changing ? (
          <VisibilityModal next={changing} working />
        ) : planRefused ? (
          <VisibilityModal next="private" planRefused role={role} />
        ) : undefined
      }
      viewport={viewport}
      title="Project"
    >
      {scopeLoading ? (
        // The scope read has no text place of its own in the pane: each bar
        // stands for a text the project supplies, not for the read, so screen
        // readers hear the read alone.
        <Pending label="Loading settings" labelMode="screen-reader-only">
          {layout}
        </Pending>
      ) : (
        layout
      )}
    </SettingsSurface>
  );
}

export function SettingsProjectScreen({ viewport }: { viewport: Viewport }) {
  return <ProjectPane viewport={viewport} state="default" />;
}

export function SettingsProjectEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <ProjectPane viewport={viewport} state="empty" />;
}

export function SettingsProjectLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <ProjectPane viewport={viewport} state="loading" />;
}

export function SettingsProjectErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <ProjectPane viewport={viewport} state="error" />;
}

/** The visibility confirmation in flight over the pane. */
export function SettingsProjectVisibilityScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <ProjectPane
      viewport={viewport}
      state="default"
      changing="public"
      screen="product/settings/project/visibility"
    />
  );
}

/** The same confirmation in flight for a public project made private. */
export function SettingsProjectMakingPrivateScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <ProjectPane
      viewport={viewport}
      state="default"
      changing="private"
      screen="product/settings/project/visibility/private"
    />
  );
}

/** A free-plan refusal in the visibility modal, with the owner's way on. */
export function SettingsProjectPlanScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <ProjectPane
      viewport={viewport}
      state="default"
      planRefused
      screen="product/settings/project/visibility/plan"
    />
  );
}

/** The same modal refusal read by an admin, who asks an owner to upgrade. */
export function SettingsProjectPlanAdminScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <ProjectPane
      viewport={viewport}
      state="default"
      planRefused
      role="admin"
      screen="product/settings/project/visibility/plan-admin"
    />
  );
}

/** The pane of a project that cannot build, where one sentence replaces the switch. */
export function SettingsProjectNoBuildsScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <ProjectPane
      viewport={viewport}
      state="default"
      builds={false}
      screen="product/settings/project/no-builds"
    />
  );
}

/**
 * The Automatic builds switch's own write: the switch shows the value asked
 * for, disabled, with "Saving…" beside its label, and the pane around it stays
 * as it was, because the switch writes without the pane's Save.
 */
export function SettingsProjectBuildsSavingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <ProjectPane
      viewport={viewport}
      state="default"
      buildsSaving
      screen="product/settings/project/builds-saving"
    />
  );
}

/**
 * The pane asked for by its address while the settings scope loads: the rail
 * draws the sections that the address's scope gives an owner, and the pane
 * draws its own layout with each text that the project supplies as a bar and
 * the Automatic builds switch, whose value the project decides, as a
 * placeholder in its own box.
 */
export function SettingsProjectScopeLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <ProjectPane
      viewport={viewport}
      state="default"
      scopeLoading
      screen="product/settings/project/scope-loading"
    />
  );
}
