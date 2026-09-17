import type { CatalogueReadModel } from "../catalogue/types.js";
import type { Box, FrameEvent } from "../client/frame_adapter.js";

import type { ViewerFrame } from "./frame_views.js";
import type { GeometryRefresh } from "./geometry_refresh.js";
import { highlightKeys } from "./highlight_request.js";
import type { InspectionScope } from "./inspection_scope.js";

/** Reuse the shell's label buttons; label text comes exclusively from catalogue data. */
export function drawFrameLabels(
  layer: HTMLElement,
  frames: readonly {
    frame: ViewerFrame;
    boxes: readonly { key: string; boxes: readonly Box[] }[];
  }[],
  model: CatalogueReadModel,
  choose: (frame: ViewerFrame, key: string) => void,
): void {
  const bounds = layer.getBoundingClientRect();
  const existing = new Map(
    [...layer.querySelectorAll<HTMLButtonElement>("button")].flatMap(
      (button) =>
        button.dataset["moklyLabelKey"]
          ? [[button.dataset["moklyLabelKey"], button] as const]
          : [],
    ),
  );
  const retained = new Set<HTMLButtonElement>();
  for (const { frame, boxes } of frames) {
    const rectangle = frame.element.getBoundingClientRect();
    if (!frame.element.getClientRects().length) continue;
    const scale = rectangle.width / frame.element.offsetWidth;
    for (const region of boxes) {
      const box = region.boxes[0];
      if (!box || frame.view?.usage.status !== "ready") continue;
      const instance = frame.view.usage.instances.find(
        (item) => item.key === region.key,
      );
      const component = model.components.find(
        (item) => item.id === instance?.componentId,
      );
      const labelKey = JSON.stringify([
        frame.entry.id,
        frame.variantId,
        frame.stepIndex,
        frame.view.viewport,
        frame.view.colorScheme,
        region.key,
      ]);
      const button =
        existing.get(labelKey) ?? layer.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "mbk-highlight-label";
      button.dataset["moklyLabelKey"] = labelKey;
      button.textContent = `${component?.title ?? "Component"} · ${instance?.id ?? ""}`;
      button.style.left = `${rectangle.left - bounds.left + (box.x + frame.element.clientLeft) * scale}px`;
      button.style.top = `${Math.max(0, rectangle.top - bounds.top + (box.y + frame.element.clientTop) * scale - 22)}px`;
      button.style.pointerEvents = "auto";
      button.onclick = () => choose(frame, region.key);
      layer.append(button);
      retained.add(button);
    }
  }
  for (const button of layer.querySelectorAll<HTMLButtonElement>("button"))
    if (!retained.has(button)) button.remove();
}

export function renderFrameLabels(
  root: HTMLElement,
  scope: InspectionScope,
  geometry: GeometryRefresh,
  model: CatalogueReadModel,
  active: () => boolean,
  receive: (frame: ViewerFrame, event: FrameEvent) => void,
): void {
  const regions = scope.sessions.map((session) => {
    const { frame } = session;
    const snapshot = geometry.snapshot(session);
    if (snapshot.result?.kind === "error") throw snapshot.result.error;
    return {
      frame,
      boxes: (snapshot.result?.kind === "ready"
        ? snapshot.result.boundaries
        : []
      )
        .filter((item) =>
          highlightKeys(frame, scope.request).includes(item.key),
        )
        .map((item) => ({
          key: item.key,
          boxes: item.ranges.flatMap((range) => range.boxes),
        })),
    };
  });
  const layer = root.querySelector<HTMLElement>("[data-mokly-label-layer]");
  if (layer && active())
    drawFrameLabels(layer, regions, model, (frame, key) => {
      if (!active()) return;
      const boxes =
        regions
          .find((item) => item.frame === frame)
          ?.boxes.find((item) => item.key === key)?.boxes ?? [];
      receive(frame, { type: "click", key, boxes });
    });
}
