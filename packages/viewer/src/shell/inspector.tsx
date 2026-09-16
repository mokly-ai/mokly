/** Shared tabbed inspector, kept outside the scrolling preview. */
import type { Catalogue } from "./catalogue.js";
import { EntryDetailsBody } from "./details.js";
import type { WorkspaceData } from "./workspace_data.js";
import { WorkspaceIcon, type WorkspaceIconName } from "./workspace_icons.js";

export function Inspector({
  catalogue,
  data,
}: {
  catalogue: Catalogue;
  data: WorkspaceData;
}) {
  const nested =
    data.previewGeneration !== undefined ||
    data.entry.kind === "screen" ||
    data.views.some((view) => view.usage?.instances.length);
  const tabs: { id: WorkspaceIconName; title: string }[] = [
    { id: "details", title: "Details" },
    ...(nested
      ? [
          {
            id: "components" as const,
            title:
              data.entry.kind === "component"
                ? "Nested components"
                : "Components",
          },
        ]
      : []),
    { id: "props", title: "Props" },
    { id: "usage", title: "Usage" },
  ];
  return (
    <section
      className="mbk-inspector"
      data-workspace-inspector=""
      aria-label="Inspector"
    >
      <div
        className="mbk-inspector-resize"
        data-inspector-resize=""
        role="separator"
        aria-label="Resize inspector"
        aria-orientation="horizontal"
        aria-controls="mb-inspector-content"
        aria-valuemin={160}
        aria-valuemax={600}
        aria-valuenow={260}
        tabIndex={0}
      />
      <button
        className="mbk-sheet-grab"
        type="button"
        data-inspector-size=""
        aria-label="Expand inspector"
        aria-expanded="false"
      >
        <span />
      </button>
      <div
        className="mbk-inspector-tabs"
        role="tablist"
        aria-label="Inspector panels"
      >
        {tabs.map((tab) => (
          <button
            type="button"
            className="mbk-icon-button"
            role="tab"
            key={tab.id}
            id={`mb-tab-${tab.id}`}
            aria-label={tab.title}
            title={tab.title}
            aria-selected="false"
            aria-controls={`mb-panel-${tab.id}`}
            data-inspector-tab={tab.id}
          >
            <WorkspaceIcon name={tab.id} />
          </button>
        ))}
        <span className="mbk-inspector-title" data-inspector-title="" />
        <button
          className="mbk-icon-button"
          type="button"
          data-inspector-close=""
          aria-label="Close inspector"
          title="Close inspector"
          hidden
        >
          <WorkspaceIcon name="close" />
        </button>
      </div>
      <div
        className="mbk-inspector-content"
        id="mb-inspector-content"
        data-mokly-scroll="inspector"
        hidden
      >
        {tabs.map((tab) => (
          <section
            key={tab.id}
            role="tabpanel"
            id={`mb-panel-${tab.id}`}
            aria-labelledby={`mb-tab-${tab.id}`}
            data-inspector-panel={tab.id}
            hidden
          >
            {tab.id === "details" ? (
              <>
                <EntryDetailsBody catalogue={catalogue} entry={data.entry} />
                <section
                  className="mbk-comparison-evidence"
                  data-workspace-evidence=""
                  hidden
                />
              </>
            ) : null}
          </section>
        ))}
      </div>
    </section>
  );
}
