/** React label presentation for adapter-owned workspace highlights. */

import { visibleFrameBox } from "../client/component_geometry.js";
import type { InstanceBoundary } from "../client/frame_adapter.js";

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
        (item) => item.id === instance.componentId,
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
  onSelect,
}: {
  labels: readonly WorkspaceHighlightLabel[];
  onSelect(key: string, viewport: "desktop" | "mobile"): void;
}) {
  if (!labels.length) return null;
  return (
    <div
      data-mokly-label-layer=""
      style={{
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        position: "fixed",
        zIndex: 952,
      }}
    >
      {labels.map((label) => (
        <button
          className="mbk-highlight-label"
          data-instance-key={label.key}
          key={label.id}
          onClick={() => onSelect(label.key, label.viewport)}
          style={{ left: label.left, top: label.top }}
          type="button"
        >
          {label.text}
        </button>
      ))}
    </div>
  );
}
