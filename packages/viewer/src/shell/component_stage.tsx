/** Component canvases keep the real mobile/desktop renderer contexts. */
import type { ManifestComponentVariant } from "../components/manifest_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import { encodeUrlPath } from "../data/paths.js";

import { generatedFrameSource, generatedView } from "./stage_sources.js";

export function ComponentStage({
  variant,
  previewViews,
  title,
}: {
  variant: ManifestComponentVariant;
  previewViews?: readonly GeneratedComponentView[];
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
          variant.id,
          viewport,
          "light",
        );
        const previewDark = generatedView(
          previewViews,
          variant.id,
          viewport,
          "dark",
        );
        const light = previewLight
          ? generatedFrameSource(previewLight)
          : `/static/${encodeUrlPath(variant.fragments[viewport])}`;
        const dark = previewDark
          ? generatedFrameSource(previewDark)
          : variant.darkFragments?.[viewport]
            ? `/static/${encodeUrlPath(variant.darkFragments[viewport])}`
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
