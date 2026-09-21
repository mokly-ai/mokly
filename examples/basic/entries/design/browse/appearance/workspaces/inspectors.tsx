import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "../../../components/parts/workspace.js";
import { useDesignInstance } from "../../../library/composition.js";
import { inspector } from "../../../library/inspector/inspector.js";
import { propField } from "../../../library/inspector/prop-field.js";
import { DESTINATIONS } from "../../../parts/destinations.js";
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
        error="Enter a number from 0 to 24."
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
        idChip="example-welcome"
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
        <code className="mbk-code">entries/components/action.tsx</code>
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
        idChip="example-welcome"
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
export const appearanceInspectorScreens = [
  screen({
    description:
      "Editable props with the catalogue all light or all dark, including a value that fails its rule.",
    desktop: <PropsValidation viewport="desktop" />,
    id: "design-appearance-props",
    mobile: <PropsValidation viewport="mobile" />,
    rationale:
      "Native fields, their descriptions and the message for a rejected value all have to stay legible in both appearances, so the field frame, the input surface and the error text each need their own value rather than a tint of the other one.",
    slug: "props",
    title: "Props validation",
  }),
  screen({
    description:
      "The selected component instance and its recorded facts, all light or all dark.",
    desktop: <SelectedInstance viewport="desktop" />,
    id: "design-appearance-instance",
    mobile: <SelectedInstance viewport="mobile" />,
    rationale:
      "Selecting a component keeps the chosen panel, its scroll position and the selected instance when the appearance changes, so the panel is drawn from the same semantic roles as the rest of the catalogue.",
    slug: "instance",
    title: "Selected instance",
  }),
];
