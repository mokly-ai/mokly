/** One bounded component/screen workspace with saved previews and an inspector. */
import { canonicalJson } from "../components/data.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { DiffScreen } from "./diffs.js";
import { ScreenHead, targetHead } from "./head.js";
import { Inspector } from "./inspector.js";
import { TargetStage } from "./stages.js";
import { useOptionalShellStore } from "./store_context.js";
import { WorkspaceControls } from "./workspace_controls.js";
import { workspaceData, type WorkspaceData } from "./workspace_data.js";

export function ComponentWorkspace({
  catalogue,
  context,
  entry,
}: {
  catalogue: Catalogue;
  context: ShellContext;
  entry: WorkspaceData["entry"];
}) {
  const store = useOptionalShellStore();
  const target = { kind: "entry" as const, entry };
  const head = targetHead(catalogue, target);
  const data = workspaceData(catalogue, context, entry);
  const selectedVariant =
    entry.kind === "component"
      ? (data.variants.find(
          (variant) => variant.value.id === store?.state.route.variant,
        ) ?? data.variants[0])
      : undefined;
  const eligible =
    entry.kind === "component"
      ? (selectedVariant?.comparisonEligible ?? false)
      : data.comparisonEligible;
  const stage = data.removed ? (
    <div className="mbk-empty" data-mokly-stage="" data-viewport="both">
      <h2>This {entry.kind} was removed</h2>
      <p>
        {entry.kind === "component"
          ? "Select a comparison to see the previous version."
          : "There is no current preview to show."}
      </p>
    </div>
  ) : (
    <TargetStage
      catalogue={catalogue}
      target={target}
      variantId={selectedVariant?.value.id}
      {...(context.fragment ? { fragment: context.fragment } : {})}
    />
  );
  return (
    <section className="mbk-workspace" data-workspace="">
      <ScreenHead
        heading={head.title}
        id={head.id}
        crumbs={head.crumbs}
        action={<WorkspaceControls dark={catalogue.hasDarkFragments} />}
        status={
          <span
            className="mbk-entry-status"
            data-workspace-status=""
            hidden={!data.status}
          >
            {data.status}
          </span>
        }
      />
      {entry.kind === "component" ? (
        <div className="mbk-selection-bar">
          <label>
            Variant{" "}
            <select
              aria-label="Saved variant"
              data-workspace-variant=""
              onChange={(event) =>
                store?.selectVariant(event.currentTarget.value)
              }
              value={selectedVariant?.value.id}
            >
              {data.variants.map((variant) => (
                <option key={variant.value.id} value={variant.value.id}>
                  {variant.value.title}
                  {variant.removed ? " · Removed" : ""}
                </option>
              ))}
            </select>
          </label>
          <span
            className="mbk-variant-status"
            data-workspace-variant-status=""
            hidden
          />
        </div>
      ) : null}
      <p
        className="mbk-selection-error"
        role="status"
        data-workspace-error=""
        hidden
      />
      <div className="mbk-workspace-panes">
        <div className="mbk-preview-pane" data-workspace-preview="">
          {data.comparisons ? (
            <DiffScreen
              route={entry.route}
              eligible={eligible}
              component={entry.kind === "component"}
            >
              {stage}
            </DiffScreen>
          ) : (
            stage
          )}
        </div>
        <Inspector catalogue={catalogue} data={data} />
      </div>
      <script
        type="application/json"
        data-workspace-data=""
        dangerouslySetInnerHTML={{
          __html: canonicalJson(data).replaceAll("<", "\\u003c"),
        }}
      />
    </section>
  );
}
