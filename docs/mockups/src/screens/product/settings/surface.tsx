import type { ReactNode } from "react";

import type { Viewport } from "@mokly/mokly";
import { MockLink } from "@mokly/mokly";

import { LayerBeneath } from "../../../components/layer-beneath";
import { SettingsDialog } from "../../../entries/design/settings-dialog.mockup";
import { SettingsLayer } from "../../../entries/design/settings-layer.mockup";
import type { ScreenState } from "../../../fixtures/product-states";
import { stateScreenPath } from "../../../fixtures/product-states";
import { Icon } from "../icons";
import { MacWindowControls, macWindowClass } from "../mac-window";
import { Brand } from "../navigation";
import { Action } from "../page-parts";
import { ViewerStage } from "../shell";

import type { PaneId, SurfaceId } from "./panes";
import { paneScreenPath, panes, sections } from "./panes";

/**
 * The section rail. A pane in `unaddressed` has no address yet, so its entry
 * draws itself, disabled and with no link, as a control with a known label
 * does while a read runs.
 */
function Rail({
  current,
  unaddressed,
}: {
  current: SurfaceId;
  unaddressed: readonly PaneId[];
}) {
  return (
    <nav className="fo-dialog-sections" aria-label="Settings sections">
      {sections.map((section) => (
        <div className="fo-nav-group" key={section}>
          <span className="fo-group-label">{section}</span>
          <div className="fo-nav">
            {panes
              .filter((pane) => pane.section === section)
              .map((pane) => {
                const entry = (
                  <>
                    <span className="fo-nav-icon">
                      <Icon name={pane.icon} />
                    </span>
                    <span className="fo-nav-label">{pane.title}</span>
                  </>
                );
                return unaddressed.includes(pane.id) ? (
                  <a
                    key={pane.id}
                    className="fo-nav-item"
                    role="link"
                    aria-disabled="true"
                  >
                    {entry}
                  </a>
                ) : (
                  <MockLink
                    key={pane.id}
                    className="fo-nav-item"
                    to={paneScreenPath(pane.id)}
                    aria-current={current === pane.id ? "page" : undefined}
                  >
                    {entry}
                  </MockLink>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/**
 * Closing settings returns to the viewer the dialog opened over. From a pane
 * the bar returns to the settings index instead, which is a real screen.
 */
function LayerBar({ current }: { current: SurfaceId }) {
  return (
    <>
      {current === "sections" ? (
        <Action
          label="Close"
          instance="settings-layer-close"
          tone="quiet"
          size="sm"
          to="product/viewer/standalone"
        />
      ) : (
        <MockLink className="fo-layer-back" to="product/settings/sections">
          <Icon name="back" size={16} />
          Settings
        </MockLink>
      )}
      <Brand />
    </>
  );
}

/**
 * Every pane is one screen component hosted by the desktop dialog over the
 * viewer stage placeholder, or by the mobile full-screen layer. The stage keeps
 * its slots blank here, because the dialog is the subject of these entries, and
 * it is inert, so the dialog carries the document's single main landmark and
 * heading.
 */
export function SettingsSurface({
  pane,
  state,
  viewport,
  title,
  screen,
  unaddressed = [],
  modal,
  macApp = false,
  children,
}: {
  pane: SurfaceId;
  state: ScreenState;
  viewport: Viewport;
  title: string;
  /** A pane drawing one of its own situations names that entry itself. */
  screen?: string;
  /**
   * The panes whose address the surface does not know yet, such as the
   * Project panes on a durable route whose address names no project. The
   * desktop rail draws each disabled, with no link.
   */
  unaddressed?: readonly PaneId[];
  /**
   * A confirmation or reveal the pane opened over itself, or on mobile a
   * row's open menu sheet. It is drawn above the frame rather than inside the
   * pane body, because it concerns one row and the list stays where the
   * reader left it. The frame stays drawn beneath it as an inert layer.
   */
  modal?: ReactNode;
  /** Whether the page draws the Mac app window around settings. */
  macApp?: boolean;
  children: ReactNode;
}) {
  const heading = <h1 className="fo-dialog-title">{title}</h1>;
  const frame =
    viewport === "desktop" ? (
      <SettingsDialog
        moklyInstance={"settings-" + pane}
        label="Settings"
        rail={<Rail current={pane} unaddressed={unaddressed} />}
        header={heading}
        actions={
          <Action
            label="Close"
            instance="settings-dialog-close"
            tone="quiet"
            size="sm"
            to="product/viewer/standalone"
          />
        }
      >
        {children}
      </SettingsDialog>
    ) : (
      <SettingsLayer
        moklyInstance={"settings-" + pane}
        label="Settings"
        bar={<LayerBar current={pane} />}
        header={heading}
      >
        {children}
      </SettingsLayer>
    );
  return (
    <div
      className={
        "folio-root fo-settings-screen" + (macApp ? " " + macWindowClass : "")
      }
      data-mkc-screen={screen ?? stateScreenPath(paneScreenPath(pane), state)}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {viewport === "desktop" && (
        <LayerBeneath className="fo-settings-backdrop folio-root">
          <ViewerStage />
        </LayerBeneath>
      )}
      <main
        id="main"
        className={
          "fo-settings-surface" +
          (viewport === "desktop" ? " fo-settings-overlay" : "")
        }
      >
        {modal ? <LayerBeneath>{frame}</LayerBeneath> : frame}
        {modal && <div className="fo-settings-modal-layer">{modal}</div>}
      </main>
      {macApp && <MacWindowControls />}
    </div>
  );
}
