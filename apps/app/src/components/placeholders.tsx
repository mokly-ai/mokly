import { buttonHeight } from "@firna/ui/button";
import { DropdownSelector } from "@firna/ui/dropdown";
import { inputSizeTokens } from "@firna/ui/input";
import { SkeletonBar, SkeletonPulseProvider } from "@firna/ui/skeleton";
import type { ReactNode } from "react";

import { useCompact } from "../layout/viewport";
import { touchTarget } from "./action";
import { PendingName } from "./pending-name";

/**
 * The placeholder forms of the Wait composition in `folio-chrome.md`, the same
 * forms the catalogue draws from its own `placeholders.tsx`. Each one stands in
 * for one part while a read runs, inside that part's own frame, so a wait and
 * its loaded layout keep one shape: a text keeps the line box of the text it
 * replaces, and a control keeps the box of the control. Every one of them is
 * hidden from assistive technology; the waiting region, `Pending`, carries
 * `aria-busy` and the operation's one name, which `PendingName` draws.
 */

/** The State composition's glyph tile, 40px square, as the protocol draws it. */
const glyphTile = 40;

/**
 * A wait's operation and the layout that it draws. A layout with a text place
 * whose text the answer decides takes the visible name there, as a function
 * of it. Any other layout leaves the name to screen readers: as the region's
 * own status, or, for a layout whose heading waits as a bar, inside that
 * heading, as a function of the hidden name.
 */
export type WaitProps = { label: string } & (
  | { labelMode?: "visible"; children: (name: ReactNode) => ReactNode }
  | {
      labelMode: "screen-reader-only";
      children: ReactNode | ((name: ReactNode) => ReactNode);
    }
);

/**
 * The waiting region, which screens draw through `Pending`: the layout that
 * the read waits for, `aria-busy`, and the operation's name once. It lays its
 * children out with its parent's gap, so wrapping a layout moves nothing, and
 * every placeholder in it sweeps on one animation.
 */
export function WaitRegion(props: WaitProps) {
  return (
    <div className="fo-wait" aria-busy="true">
      <SkeletonPulseProvider>
        {props.labelMode !== "screen-reader-only" ? (
          props.children(<PendingName label={props.label} />)
        ) : typeof props.children === "function" ? (
          props.children(<PendingName label={props.label} hidden inText />)
        ) : (
          <>
            <PendingName label={props.label} hidden />
            {props.children}
          </>
        )}
      </SkeletonPulseProvider>
    </div>
  );
}

/**
 * One text that the answer supplies, as a bar in that text's own line box. It
 * takes the line height of the element it sits in, or of its own `className`,
 * so a heading, a title, a value or a line keeps its height while it waits.
 * `width` is a CSS length, relative to the text's font where it is in `em`.
 * The bar is a block element, which no `p` may hold, so a bar in place of a
 * paragraph carries the paragraph's class instead of sitting in it.
 */
export function TextBar({
  width,
  className,
}: {
  width: string;
  className?: string;
}) {
  return (
    <span
      className={className ? "fo-wait-text " + className : "fo-wait-text"}
      // A bar never passes the width it stands in, also at 200% text, even
      // where its text class sets a wider cap of its own.
      style={{ width, maxWidth: "100%" }}
      aria-hidden="true"
    >
      <span className="fo-wait-mark">
        <SkeletonBar flex={1} />
      </span>
    </span>
  );
}

/**
 * A control whose label or presence the answer decides: a placeholder in the
 * control's own box. The package's own scale gives the height of the size, and
 * a compact surface keeps the touch target that `Action` keeps, so the box is
 * the one the control draws. `width` is the control's width; a block control
 * takes the whole row.
 */
export function ControlPlaceholder({
  size = "lg",
  width = "100%",
}: {
  size?: "sm" | "md" | "lg";
  width?: number | "100%";
}) {
  const compact = useCompact();
  const height = compact
    ? Math.max(buttonHeight(size), touchTarget)
    : buttonHeight(size);
  return (
    <div className="fo-wait-control" aria-hidden="true">
      <SkeletonBar width={width} height={height} radius="md" />
    </div>
  );
}

/**
 * The State card in its placeholder form: its glyph tile, its line and its
 * action as placeholders, and its title naming the operation. Where the page
 * heading already names the operation, there is no `title` and the title is a
 * bar; the waiting region then names it for screen readers only. `size` is
 * the size the surface's State cards give their action: the account panel's
 * are `lg`, the viewer stage's `md`.
 */
export function StatePlaceholder({
  title,
  size = "lg",
}: {
  title?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="fo-state fo-wait-state">
      <span className="fo-state-glyph fo-wait-glyph" aria-hidden="true">
        <SkeletonBar width={glyphTile} height={glyphTile} radius="md" />
      </span>
      {title === undefined ? (
        <TextBar className="fo-state-title" width="11em" />
      ) : (
        <h2 className="fo-state-title">{title}</h2>
      )}
      <TextBar className="fo-state-detail" width="16em" />
      <div className="fo-state-action">
        <ControlPlaceholder size={size} width={112} />
      </div>
    </div>
  );
}

/**
 * One read-only fact whose value the answer supplies: its label, and a value
 * bar of one text line, for `Facts`.
 */
export function factPlaceholder(
  label: string,
  width = "8em",
): readonly [string, ReactNode] {
  return [label, <TextBar key={label} width={width} />];
}

/**
 * A select's waiting form: its label and its own trigger, read only and empty,
 * with a bar or the operation's name held where its value would be. The
 * trigger is the last part of the field, so the hold lies over its frame,
 * inset by the package's own field scale and clear of the chevron. It is sized
 * as every select in the product is: `lg` on a compact surface, `md` on a wide
 * one.
 */
export function SelectorPlaceholder({
  label,
  hold,
}: {
  label: string;
  /** The wait's name, where this select is the place that names it. */
  hold?: ReactNode;
}) {
  const size = useCompact() ? "lg" : "md";
  const sizing = inputSizeTokens(size);
  return (
    <div className="fo-wait-field">
      <DropdownSelector
        label={label}
        value=""
        placeholder=""
        triggerLabel={label}
        options={[]}
        variant="field"
        size={size}
        searchable
        readOnly
      />
      <span
        className="fo-wait-hold fo-wait-over"
        style={{
          height: sizing.boxHeight,
          fontSize: sizing.inputFontSize,
          paddingLeft: sizing.paddingHorizontal,
          paddingRight: sizing.paddingHorizontal + sizing.iconSize + sizing.gap,
        }}
      >
        {hold ?? <TextBar width="40%" />}
      </span>
    </div>
  );
}
