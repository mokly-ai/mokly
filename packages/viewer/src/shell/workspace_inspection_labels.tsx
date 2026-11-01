/** React masks and labels for registry-backed workspace highlights. */

import { HighlightLabel, LabelLayer } from "@mokly/ui/highlight-label";
import { HighlightMask } from "@mokly/ui/highlight-mask";

import { visibleFrameBox } from "../client/component_geometry.js";
import type { InstanceBoundary } from "../client/frame_adapter.js";

import { frameInspectionMask } from "./frame_inspection_mask.js";
import type { ShellFrameSession } from "./frame_registry.js";
import type { WorkspaceData } from "./workspace_data.js";

export interface WorkspaceHighlightLabel {
  id: string;
  key: string;
  left: number;
  text: string;
  top: number;
  viewport: "desktop" | "mobile";
}

/** Translate authenticated inner-frame boxes into outer viewport labels. */
export function workspaceHighlightLabels(
  data: WorkspaceData,
  measured: readonly {
    boundaries: readonly InstanceBoundary[];
    keys: readonly string[];
    session: ShellFrameSession;
  }[],
): readonly WorkspaceHighlightLabel[] {
  return measured.flatMap(({ boundaries, keys, session }) => {
    const viewport = session.identity.viewport;
    const usage = session.usage;
    const frame = session.element;
    const visible = visibleFrameBox(frame);
    if (
      !viewport ||
      usage.status !== "ready" ||
      !visible ||
      !frame.offsetWidth ||
      !frame.offsetHeight
    )
      return [];
    const rectangle = frame.getBoundingClientRect();
    const scaleX = rectangle.width / frame.offsetWidth;
    const scaleY = rectangle.height / frame.offsetHeight;
    return keys.flatMap((key) => {
      const boundary = boundaries.find((item) => item.key === key);
      const box = boundary?.ranges.flatMap((range) => range.boxes)[0];
      const instance = usage.instances.find((item) => item.key === key);
      if (!box || !instance) return [];
      const left = rectangle.left + (box.x + frame.clientLeft) * scaleX;
      const top = rectangle.top + (box.y + frame.clientTop) * scaleY;
      if (
        left + box.width * scaleX <= visible.left ||
        top + box.height * scaleY <= visible.top ||
        left >= visible.right ||
        top >= visible.bottom
      )
        return [];
      const component = data.components.find(
        (item) => item.path === instance.componentId,
      );
      return [
        {
          id: JSON.stringify([session.generation, key]),
          key,
          left: Math.max(0, left),
          text: `${component?.title ?? "Component"} · ${instance.id}`,
          top: Math.max(0, top - 22),
          viewport,
        },
      ];
    });
  });
}

/** Keep label buttons declarative while their positions come from frame geometry. */
export function WorkspaceInspectionOverlay({
  labels,
  measured,
  onSelect,
}: {
  labels: readonly WorkspaceHighlightLabel[];
  measured: readonly {
    boundaries: readonly InstanceBoundary[];
    keys: readonly string[];
    session: ShellFrameSession;
  }[];
  onSelect(key: string, viewport: "desktop" | "mobile"): void;
}) {
  const masks = measured.flatMap(({ session, boundaries, keys }) => {
    const mask = frameInspectionMask(session, boundaries, keys);
    return mask ? [mask] : [];
  });
  if (!labels.length && !masks.length) return null;
  return (
    <>
      <LabelLayer placement="viewport">
        {labels.map((label) => (
          <HighlightLabel
            instanceKey={label.key}
            key={label.id}
            left={label.left}
            onSelect={() => onSelect(label.key, label.viewport)}
            text={label.text}
            top={label.top}
          />
        ))}
      </LabelLayer>
      {masks.map(({ generation, ...mask }) => (
        <HighlightMask key={generation} {...mask} />
      ))}
    </>
  );
}
