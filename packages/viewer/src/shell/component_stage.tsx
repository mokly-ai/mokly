/** Component canvases keep the real mobile/desktop renderer contexts. */
import type { ManifestComponentVariant } from "../components/manifest_types.js";
import { encodeUrlPath } from "../data/paths.js";

export function ComponentStage({
  variant,
  title,
}: {
  variant: ManifestComponentVariant;
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
        const light = `/static/${encodeUrlPath(variant.fragments[viewport])}`;
        const dark = variant.darkFragments?.[viewport];
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
              data-fragment-dark={
                dark ? `/static/${encodeUrlPath(dark)}` : undefined
              }
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
