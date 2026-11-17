import { WebModalFrame } from "@firna/ui/modal";
import { useEffect } from "react";
import type { ReactNode, RefObject } from "react";
import type { ViewStyle } from "react-native";

import { Action } from "../components/action";
import { AppLink } from "../components/app-link";
import { Brand } from "../components/brand";
import { Icon } from "../components/icons";

import { sections } from "./panes";
import type { PaneDefinition, SurfaceId } from "./panes";
import { paneRoute } from "./routes";
import type { SettingsScopeSlugs } from "./routes";

// The dialog is 960px wide, never taller than 90dvh, and never shorter than
// 700px, so a short pane is not mostly empty and most pane switches leave the
// frame where the reader's pointer left it. The minimum yields to the cap on a
// short window, where 90dvh is the smaller of the two.
const surfaceStyle: ViewStyle = {
  maxWidth: 960,
  width: "100%",
  minHeight: "min(700px, 90dvh)" as unknown as number,
  maxHeight: "90dvh" as unknown as number,
  borderRadius: 10,
};

// The frame's own header is not drawn: the rail runs the dialog's full height,
// so the pane's heading and Close belong in the pane column beside it, which is
// the bar the catalogue draws. What the frame still renders is the target its
// `aria-labelledby` points at, hidden from view and from assistive technology,
// so the bar's heading is the only one either can reach.
const headerStyle: ViewStyle = { display: "none" };

// A React Native view does not shrink by default, so the frame's body has to
// be told it may: without this it grows to its content and the pane's own
// scroll region never engages inside the capped surface.
const bodyStyle: ViewStyle = {
  padding: 0,
  flexGrow: 1,
  flexShrink: 1,
  minHeight: 0,
};

/**
 * The section rail. A pane whose address the surface does not know yet draws
 * its entry itself, disabled and with no link, as a control with a known
 * label does while a read runs, so no entry leads anywhere but its pane.
 */
function Rail({
  current,
  available,
  href,
  goToPane,
  activeRef,
}: {
  current: SurfaceId;
  available: readonly PaneDefinition[];
  href: (pane: SurfaceId) => string | undefined;
  goToPane: (pane: SurfaceId) => void;
  activeRef?: RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <nav className="fo-dialog-sections" aria-label="Settings sections">
      {sections
        .filter((section) => available.some((pane) => pane.section === section))
        .map((section) => (
          <div className="fo-nav-group" key={section}>
            <span className="fo-group-label">{section}</span>
            <div className="fo-nav">
              {available
                .filter((pane) => pane.section === section)
                .map((pane) => {
                  const address = href(pane.id);
                  const entry = (
                    <>
                      <span className="fo-nav-icon">
                        <Icon name={pane.icon} />
                      </span>
                      <span className="fo-nav-label">{pane.title}</span>
                    </>
                  );
                  return address === undefined ? (
                    <a
                      key={pane.id}
                      className="fo-nav-item"
                      role="link"
                      aria-disabled="true"
                    >
                      {entry}
                    </a>
                  ) : (
                    <AppLink
                      key={pane.id}
                      className="fo-nav-item"
                      href={address}
                      current={current === pane.id}
                      onPress={() => goToPane(pane.id)}
                      linkRef={current === pane.id ? activeRef : undefined}
                    >
                      {entry}
                    </AppLink>
                  );
                })}
            </div>
          </div>
        ))}
    </nav>
  );
}

/**
 * The desktop presentation: the package's modal frame supplies the portal, the
 * focus trap, the inert page beneath, Escape and the backdrop, while the
 * composition inside it is the catalogue's own — a section rail at full height
 * beside one pane, whose bar carries the pane's single heading and Close.
 * Focus lands on the pane the reader asked for, not the first rail row.
 */
export function SettingsDialog({
  pane,
  title,
  available,
  href,
  goToPane,
  onClose,
  activeRef,
  children,
}: {
  pane: SurfaceId;
  title: string;
  available: readonly PaneDefinition[];
  /** Each pane's address, or nothing while the surface does not know it. */
  href: (pane: SurfaceId) => string | undefined;
  goToPane: (pane: SurfaceId) => void;
  onClose: () => void;
  activeRef?: RefObject<HTMLAnchorElement | null>;
  children: ReactNode;
}) {
  // The dialog opens before it knows which pane the reader asked for, so the
  // frame's own opening focus lands on the first rail row. Once the pane is
  // resolved its row takes the focus, which is also a no-op for a reader who
  // arrived by clicking that row.
  useEffect(() => {
    activeRef?.current?.focus();
  }, [pane, activeRef]);
  return (
    <WebModalFrame
      title={title}
      onClose={onClose}
      showCloseButton={false}
      size="lg"
      scroll={false}
      surfaceStyle={surfaceStyle}
      bodyStyle={bodyStyle}
      headerStyle={headerStyle}
      initialFocusRef={activeRef}
      testID="settings-dialog"
    >
      <div className="fo-dialog-live" data-mkc-screen={"settings-" + pane}>
        <div className="fo-dialog-rail">
          <Rail
            current={pane}
            available={available}
            href={href}
            goToPane={goToPane}
            activeRef={activeRef}
          />
        </div>
        <main id="main" className="fo-dialog-pane">
          <div className="fo-dialog-bar">
            <div className="fo-dialog-heading">
              <h1 className="fo-dialog-title">{title}</h1>
            </div>
            <Action
              label="Close"
              tone="quiet"
              size="sm"
              onPress={onClose}
              testID="close-settings"
            />
          </div>
          <div className="fo-dialog-body">{children}</div>
        </main>
      </div>
    </WebModalFrame>
  );
}

/**
 * The compact presentation: the same pane component as a full-screen route,
 * whose bar returns to the settings index or closes settings.
 */
export function SettingsLayer({
  pane,
  title,
  back,
  children,
}: {
  pane: SurfaceId;
  title: string;
  back: { label: string; href: string; onPress?: () => void };
  children: ReactNode;
}) {
  return (
    <div
      className="folio-root fo-settings-screen"
      data-mkc-screen={"settings-" + pane}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <main id="main" className="fo-settings-surface">
        <section className="fo-layer" aria-label="Settings">
          <div className="fo-layer-bar">
            {pane === "sections" ? (
              <Action
                label={back.label}
                tone="quiet"
                size="sm"
                href={back.onPress ? undefined : back.href}
                onPress={back.onPress}
                testID="close-settings"
              />
            ) : (
              <AppLink
                className="fo-layer-back"
                href={back.href}
                onPress={back.onPress}
              >
                <Icon name="back" size={16} />
                {back.label}
              </AppLink>
            )}
            <Brand />
          </div>
          <div className="fo-layer-body">
            <div className="fo-layer-heading">
              <h1 className="fo-dialog-title">{title}</h1>
            </div>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

/** The durable route form of a pane, for the mobile layer's own links. */
export function layerHref(scope: SettingsScopeSlugs) {
  return (pane: SurfaceId) => paneRoute(pane, scope);
}
