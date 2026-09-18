/** Accessible separator rendered at the desktop navigation panel edge. */

/** Pointer- and keyboard-operable navigation resize handle. */
export function NavigationResizeHandle() {
  return (
    <div
      aria-label="Resize navigation panel"
      aria-orientation="vertical"
      aria-valuemax={480}
      aria-valuemin={192}
      aria-valuenow={248}
      className="mbk-nav-resize"
      data-mokly-nav-resize=""
      role="separator"
      tabIndex={0}
      title="Drag to resize. Use arrow keys for precise control."
    />
  );
}
