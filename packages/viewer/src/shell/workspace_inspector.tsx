/** The workspace inspector's panels, which point back to Static while Live. */

import type { ReactNode } from "react";

import type { GeneratedComponentView } from "../components/views.js";
import type { ReviewResult } from "../review/types.js";

import type { Catalogue } from "./catalogue.js";
import { Inspector } from "./inspector.js";
import { LIVE_PREVIEW_COPY } from "./preview_mode.js";
import type { UsageDeliveryState } from "./use_workspace_data.js";
import type { WorkspaceData } from "./workspace_data.js";
import { WorkspaceEvidence } from "./workspace_evidence.js";
import { WorkspaceInstances } from "./workspace_instances.js";
import { WorkspaceUsage } from "./workspace_usage.js";

type Viewport = "desktop" | "mobile";

/**
 * Details stays unchanged in Live. Components, Props or Controls, and Usage
 * keep their tabs but read or edit the rendered view, so each shows one line.
 */
export function WorkspaceInspector({
  activeViewport,
  catalogue,
  components,
  data,
  live,
  loaded,
  onFocus,
  onSelect,
  onViewport,
  props,
  selectedKey,
  variantId,
  views,
  usageDelivery,
}: {
  activeViewport: Viewport;
  catalogue: Catalogue;
  components: boolean;
  data: WorkspaceData;
  live: boolean;
  loaded?: ReviewResult | undefined;
  onFocus(key: string, viewport: Viewport): void;
  onSelect(key: string, viewport: Viewport): void;
  onViewport(viewport: Viewport): void;
  props: ReactNode;
  selectedKey?: string | undefined;
  variantId?: string | undefined;
  views: readonly GeneratedComponentView[];
  usageDelivery: UsageDeliveryState;
}) {
  const notice = live ? (
    <p className="mbk-inspector-notice" data-live-notice="">
      {LIVE_PREVIEW_COPY.notice}
    </p>
  ) : undefined;
  return (
    <Inspector
      catalogue={catalogue}
      data={data}
      panels={{
        ...(components
          ? {
              components: notice ?? (
                <WorkspaceInstances
                  activeViewport={activeViewport}
                  data={data}
                  onFocus={onFocus}
                  onSelect={onSelect}
                  onViewport={onViewport}
                  {...(selectedKey ? { selectedKey } : {})}
                  views={views}
                />
              ),
            }
          : {}),
        details: (
          <WorkspaceEvidence
            data={data}
            {...(loaded ? { loaded } : {})}
            {...(variantId ? { variantId } : {})}
          />
        ),
        props: notice ?? props,
        usage: notice ?? (
          <WorkspaceUsage data={data} delivery={usageDelivery} />
        ),
      }}
    />
  );
}
