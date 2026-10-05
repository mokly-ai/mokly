import {
  ActionPropValues,
  actionVariants,
} from "../../components/parts/action_props.js";
import { ComponentInfo } from "../../components/parts/component_info.js";
import { ComponentLayout } from "../../components/parts/component_layout.js";
import { UsedBy } from "../../components/parts/component_usage.js";
import { VariantPicker } from "../../components/parts/controls.js";
import { Inspector } from "../../components/parts/inspector.js";
import { COMPONENT_ENTRIES } from "../../components/parts/metadata.js";
import {
  ActionExample,
  ComponentCanvas,
} from "../../components/parts/preview.js";
import type { RebuildDepiction } from "../../parts/rebuild_status.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import { INTERACTIVE_PAGES } from "./destinations.js";
import { StaticNotice } from "./static_notice.js";

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
 * carry one secondary line instead of their content. A depicted rebuild
 * status adds only its shell chrome; the workspace itself is unchanged.
 */
export function WorkspaceModeScreen({
  live,
  rebuild,
  viewport,
}: {
  live: boolean;
  rebuild?: RebuildDepiction | undefined;
  viewport: ArtboardViewport;
}) {
  const design = live
    ? INTERACTIVE_PAGES.component
    : INTERACTIVE_PAGES.staticCatalogue;
  const notice = <StaticNotice />;
  return (
    <ComponentLayout
      design={design}
      entry={COMPONENT_ENTRIES.action}
      highlight={{ active: false, unavailable: live ? "live" : undefined }}
      rebuild={rebuild}
      viewport={viewport}
      variants={<VariantPicker state="default" current={design} />}
      inspector={
        <Inspector
          initial="props"
          panels={[
            {
              id: "info",
              label: "Details",
              content: <ComponentInfo entry={COMPONENT_ENTRIES.action} />,
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
