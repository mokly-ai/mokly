import { defineScreen } from "@mokly/mokly";

import { CONTROLS_COPY } from "../../../components/controls/parts/copy.js";
import { PreviewWorkspace } from "../../../components/parts/workspace.js";
import { useDesignInstance } from "../../../library/composition.js";
import { inspector } from "../../../library/inspector/inspector.js";
import { propField } from "../../../library/inspector/prop-field.js";
import { appearanceDesignMetadata } from "../../../metadata.js";
import { artboards } from "../../../parts/artboards.js";
import { DESTINATIONS } from "../../../parts/destinations.js";
import { ENTRY_PATHS } from "../../../parts/entry_paths.js";
import { MetaRow } from "../../../parts/metadata_row.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import {
  AppearanceHead,
  AppearanceShell,
  WelcomeShot,
} from "../parts/scaffold.js";

function PropsBody() {
  return (
    <>
      <propField.Component
        moklyInstance={useDesignInstance("label")}
        label="label"
        inputId="appearance-label"
        optional={false}
        supplied
        control={
          <input id="appearance-label" type="text" defaultValue="Continue" />
        }
      />
      <propField.Component
        moklyInstance={useDesignInstance("radius")}
        label="cornerRadius"
        inputId="appearance-radius"
        optional={false}
        supplied
        error={CONTROLS_COPY.numberError(0, 24, 1)}
        control={
          <input
            id="appearance-radius"
            type="number"
            min={0}
            max={24}
            defaultValue={32}
            aria-invalid="true"
            aria-describedby="appearance-radius-error"
          />
        }
      />
      <propField.Component
        moklyInstance={useDesignInstance("emphasis")}
        label="emphasis"
        inputId="appearance-emphasis"
        optional={false}
        supplied
        control={
          <select id="appearance-emphasis" defaultValue="strong">
            <option value="strong">Strong</option>
            <option value="quiet">Quiet</option>
          </select>
        }
      />
    </>
  );
}

function PropsValidation({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      design={DESTINATIONS.appearanceProps}
      viewport={viewport}
    >
      <AppearanceHead
        path={ENTRY_PATHS.welcome}
        title="Welcome"
        viewport={viewport}
      />
      <PreviewWorkspace
        inspector={
          <inspector.Component
            moklyInstance={useDesignInstance("inspector")}
            tabs={[
              { id: "info", label: "Details" },
              { id: "props", label: "Props" },
            ]}
            initial="props"
            sheetSize="compact"
            info={<p>The saved example currently shown on the stage.</p>}
            props={<PropsBody />}
          />
        }
        viewport={viewport}
        render={(previewViewport) => <WelcomeShot viewport={previewViewport} />}
      />
    </AppearanceShell>
  );
}

function InstanceBody() {
  return (
    <div className="mbk-meta">
      <MetaRow name="component" label="Component">
        Action
      </MetaRow>
      <MetaRow name="instance" label="Instance">
        <code className="mbk-code">welcome-primary</code>
      </MetaRow>
      <MetaRow name="variant" label="Variant">
        Default
      </MetaRow>
      <MetaRow name="source" label="Source">
        <code className="mbk-code">src/components/action/action.mokly.tsx</code>
      </MetaRow>
    </div>
  );
}

function SelectedInstance({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      design={DESTINATIONS.appearanceInstance}
      viewport={viewport}
    >
      <AppearanceHead
        path={ENTRY_PATHS.welcome}
        title="Welcome"
        viewport={viewport}
      />
      <PreviewWorkspace
        inspector={
          <inspector.Component
            moklyInstance={useDesignInstance("inspector")}
            tabs={[
              { id: "info", label: "Details" },
              { id: "components", label: "Components" },
            ]}
            initial="components"
            sheetSize="compact"
            info={<p>The saved example currently shown on the stage.</p>}
            components={<InstanceBody />}
          />
        }
        viewport={viewport}
        render={(previewViewport) => <WelcomeShot viewport={previewViewport} />}
      />
    </AppearanceShell>
  );
}

/** The two inspector panels an appearance change has to keep readable. */
export const propsScreen = defineScreen({
  ...appearanceDesignMetadata,
  description:
    "Editable props with the catalogue all light or all dark, including a value that fails its rule.",
  ...artboards({
    desktop: <PropsValidation viewport="desktop" />,
    mobile: <PropsValidation viewport="mobile" />,
  }),
  slug: "props",
  rationale:
    "Native fields, their descriptions and the message for a rejected value all have to stay legible in both appearances, so the field frame, the input surface and the error text each need their own value rather than a tint of the other one.",
  title: "Props validation",
});
export const instanceScreen = defineScreen({
  ...appearanceDesignMetadata,
  description:
    "The selected component instance and its recorded facts, all light or all dark.",
  ...artboards({
    desktop: <SelectedInstance viewport="desktop" />,
    mobile: <SelectedInstance viewport="mobile" />,
  }),
  slug: "instance",
  rationale:
    "Selecting a component keeps the chosen panel, its scroll position and the selected instance when the appearance changes, so the panel is drawn from the same semantic roles as the rest of the catalogue.",
  title: "Selected instance",
});
