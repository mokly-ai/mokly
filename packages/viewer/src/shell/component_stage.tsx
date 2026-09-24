/** Component canvases keep the real mobile/desktop renderer contexts. */
import {
  currentDocumentPath,
  type GeneratedPathPrefix,
} from "../catalogue/delivery_paths.js";
import type { ManifestComponentVariant } from "../components/manifest_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import { framePath } from "./stage_sources.js";
import { generatedFrameSource, generatedView } from "./stage_sources.js";

export function ComponentStage({
  variant,
  previewViews,
  title,
  prefix,
}: {
  prefix?: GeneratedPathPrefix;
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
          ? generatedFrameSource(previewLight, undefined, undefined, prefix)
          : framePath(currentDocumentPath(variant.fragments[viewport], prefix));
        const dark = previewDark
          ? generatedFrameSource(previewDark, undefined, undefined, prefix)
          : variant.darkFragments?.[viewport]
            ? framePath(
                currentDocumentPath(variant.darkFragments[viewport], prefix),
              )
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
