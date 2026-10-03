import { DrawnScrollbar } from "./compare_scroll.js";
import { WelcomeRows } from "./mini_screens.js";

/** The example app's own sections, drawn as text because nothing links. */
const APP_SECTIONS = ["Welcome", "Screens", "Handbook", "Tour"] as const;

/**
 * Welcome built as an app shell: the page itself never scrolls, its top bar
 * and navigation stay where they are, and the main panel scrolls on its own.
 * The panel is drawn part-way down with its own scrollbar. Narrow layouts move
 * the navigation below the panel as a tab bar. Links inside a comparison do
 * nothing, so the sketch carries none.
 */
export function MiniWelcomeApp({
  compact,
  revised,
}: {
  compact?: boolean | undefined;
  revised?: boolean | undefined;
}) {
  const navigation = (
    <div className="mbk-app-nav">
      {APP_SECTIONS.map((section, index) => (
        <span data-current={index === 0 ? "" : undefined} key={section}>
          {section}
        </span>
      ))}
    </div>
  );
  const panel = (
    <div className="mbk-app-panel" data-scrolled="">
      <div className="mbk-app-panel-content">
        <WelcomeRows revised={revised} />
      </div>
      <DrawnScrollbar />
    </div>
  );
  return (
    <div className="mbk-shot mbk-shot--app">
      <div className="mbk-app-bar">Example</div>
      {compact ? (
        <>
          {panel}
          {navigation}
        </>
      ) : (
        <>
          {navigation}
          {panel}
        </>
      )}
    </div>
  );
}
