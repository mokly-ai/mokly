import type { ReactNode } from "react";

import type { RenderInput } from "@mokly/mokly";

import { PreviewWorkspace } from "../components/parts/workspace.js";
import { DesignAppearanceScope } from "../parts/appearance.js";
import { canvasScope } from "../parts/canvas_palette.js";

import { CANVAS_SAMPLES } from "./metadata.js";

/**
 * Standalone samples share tokens and layout constraints, without scenario
 * data. The sample root carries the viewer root class and states the
 * requested scheme as its theme, so the package components draw in the
 * shipped palette, as they do inside a shell. The design palette's
 * appearance scope wraps the root, as it wraps a screen's shell root, so the
 * theme that the root declares wins over the design palette that the root
 * inherits. A Canvas part's root declares the Canvas palette instead, as a
 * Canvas artboard's root does.
 */
export function LibraryHost({
  input,
  children,
}: {
  input: RenderInput;
  children: ReactNode;
}) {
  // Library paths are design/library/{group}/{slug}, then a variant's slug.
  const slug = input.entry.path.split("/")[3] ?? "";
  const content =
    slug === "inspector" ? (
      <PreviewWorkspace
        inspector={children}
        render={() => null}
        viewport={input.viewport}
      />
    ) : slug === "metadata-row" && input.props.presentation === "props" ? (
      <dl className="mbk-props">{children}</dl>
    ) : (
      children
    );
  const host = (
    <div className={`mbk-library-host mbk-shell--${input.viewport}`}>
      {content}
    </div>
  );
  if (CANVAS_SAMPLES.has(slug)) {
    const scope = canvasScope(input.colorScheme);
    return (
      <div
        {...scope}
        className={`${scope.className} mbk-library`}
        data-library-component={slug}
      >
        {host}
      </div>
    );
  }
  return (
    <DesignAppearanceScope>
      <div
        className="mbk mbk-library"
        data-library-component={slug}
        data-mokly-theme={input.colorScheme}
      >
        {host}
      </div>
    </DesignAppearanceScope>
  );
}
