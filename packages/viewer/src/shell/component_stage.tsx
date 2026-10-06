/** Component canvases keep the real mobile/desktop renderer contexts. */

import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import type { ManifestComponentVariant } from "../components/manifest_types.js";
import { encodeUrlPath } from "../data/paths.js";
import { viewRoute } from "../navigation/routes.js";

import { generatedFrameSource, generatedView } from "./stage_sources.js";
import type { ShellGeneratedView } from "./usage_types.js";

export function ComponentStage({
  variant,
  previewViews,
  title,
}: {
  variant: ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>;
  previewViews?: readonly ShellGeneratedView[];
  title: string;
}) {
  return (
    <div
      className="mbk-stage mbk-component-stage"
      data-mokly-scroll="stage"
      data-mokly-stage=""
      data-viewport="both"
    >
      {(["mobile", "desktop"] as const).map((viewport) => {
        const previewLight = generatedView(
          previewViews,
          variant.path,
          viewport,
          "light",
        );
        const previewDark = generatedView(
          previewViews,
          variant.path,
          viewport,
          "dark",
        );
        const light = previewLight
          ? generatedFrameSource(previewLight)
          : `/static/${encodeUrlPath(viewRoute(variant.path, viewport, "light"))}`;
        const dark = previewDark
          ? generatedFrameSource(previewDark)
          : variant.colorSchemes.includes("dark")
            ? `/static/${encodeUrlPath(viewRoute(variant.path, viewport, "dark"))}`
            : undefined;
        return (
          <section
            className={`mbk-component-canvas mbk-frame-${viewport}`}
            key={viewport}
          >
            <p className="mbk-frame-label">
              {viewport === "mobile" ? "Mobile" : "Desktop"}
            </p>
            <iframe
              className="mbk-frag"
              data-workspace-frame={viewport}
              data-mokly-fragment-frame=""
              data-fragment-light={light}
              data-fragment-dark={dark}
              src={light}
              sandbox="allow-same-origin"
              title={`${title} — ${viewport}`}
            />
          </section>
        );
      })}
    </div>
  );
}
