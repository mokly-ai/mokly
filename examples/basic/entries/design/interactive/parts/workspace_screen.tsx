import {
  ActionPropValues,
  actionVariants,
} from "../../components/parts/action_props.js";
import { ComponentInfo } from "../../components/parts/component_info.js";
import { ComponentLayout } from "../../components/parts/component_layout.js";
import { UsedBy } from "../../components/parts/component_usage.js";
import { VariantPicker } from "../../components/parts/controls.js";
import { Inspector } from "../../components/parts/inspector.js";
import {
  ActionExample,
  ComponentCanvas,
} from "../../components/parts/preview.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import { INTERACTIVE_PAGES } from "./destinations.js";

const STATIC_NOTICE = "Switch to Static to inspect or edit this view.";

function SavedProps() {
  return (
    <section>
      <h3>Supplied props</h3>
      <ActionPropValues props={actionVariants.default.props} />
    </section>
  );
}

/**
 * A component's saved example in the workspace. While Live is selected the
 * inspector keeps every tab, and the tabs that read or edit the rendered view
 * carry one secondary line instead of their content.
 */
export function WorkspaceModeScreen({
  live,
  viewport,
}: {
  live: boolean;
  viewport: ArtboardViewport;
}) {
  const design = live
    ? INTERACTIVE_PAGES.component
    : INTERACTIVE_PAGES.staticCatalogue;
  const notice = <p className="ce-muted">{STATIC_NOTICE}</p>;
  return (
    <ComponentLayout
      design={design}
      highlight={{ active: false, unavailable: live ? "live" : undefined }}
      identity="action"
      viewport={viewport}
      variants={<VariantPicker state="default" current={design} />}
      inspector={
        <Inspector
          initial="props"
          panels={[
            {
              id: "info",
              label: "Details",
              content: <ComponentInfo identity="action" />,
            },
            {
              id: "props",
              label: "Props",
              content: live ? notice : <SavedProps />,
            },
            {
              id: "usage",
              label: "Usage",
              content: live ? notice : <UsedBy state="default" />,
            },
          ]}
        />
      }
    >
      {(previewViewport) => (
        <ComponentCanvas viewport={previewViewport}>
          <ActionExample {...actionVariants.default.props} />
        </ComponentCanvas>
      )}
    </ComponentLayout>
  );
}
