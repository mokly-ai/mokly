/** Loading of the package-owned assets the shell serves: the allowlisted
 * browser client modules and the packaged shell font files. */

import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { viewerAssetUrl } from "@mokly/viewer/server";

import { MoklyError, errorMessage } from "../errors.js";

/** Load the allowlisted browser modules before the HTTP server binds. */
export function loadBrowserClientModules(): ReadonlyMap<string, Buffer> {
  const modules = new Map<string, Buffer>();
  for (const filename of [
    "browse.js",
    "browse_runtime.js",
    "services.js",
    "catalogue_updates.js",
    "early_disclosures.js",
    "workspace_inspection.js",
    "browse_controls.js",
    "browse_update_state.js",
    "browse_evidence.js",
    "browse_fetch.js",
    "browse_refresh.js",
    "workspace_updates.js",
    "diffs.js",
    "diff_views.js",
    "workspace.js",
    "workspace_loading.js",
    "component_controls.js",
    "control_fields.js",
    "control_view_key.js",
    "control_transport.js",
    "control_surface.js",
    "workspace_events.js",
    "workspace_props.js",
    "workspace_variants.js",
    "workspace_preview.js",
    "workspace_evidence.js",
    "workspace_evidence_data.js",
    "style_evidence.js",
    "entry_wording.js",
    "prop_display.js",
    "inspector_resize.js",
    "inspector_tabs.js",
    "inspector_panels.js",
    "frame_adapter.js",
    "frame_error.js",
    "frame_mount.js",
    "frame_usage.js",
    "message_transport.js",
    "post_message_adapter.js",
    "same_origin_adapter.js",
    "same_origin_access.js",
    "same_origin_mount.js",
    "same_origin_pointer.js",
    "same_origin_navigation.js",
    "same_origin_highlight.js",
    "document_ranges.js",
    "inspector.js",
    "component_geometry.js",
    "component_range_nodes.js",
    "component_occlusion.js",
    "component_overlay.js",
    "component_highlight.js",
    "browse_details.js",
    "browse_links.js",
    "browse_frames.js",
    "browse_navigation.js",
    "browse_navigation_state.js",
    "frame_navigation.js",
    "browse_state.js",
    "browse_recovery.js",
    "browser.js",
    "clipboard.js",
    "live_updates.js",
    "navigation.js",
    "navigation-resize.js",
    "preview_fragment.js",
    "search_query.js",
    "static_delivery.js",
    "tag_filter.js",
  ]) {
    const candidate = fileURLToPath(
      [
        "browse.js",
        "browser.js",
        "live_updates.js",
        "control_transport.js",
        "workspace_loading.js",
        "browse_refresh.js",
      ].includes(filename)
        ? new URL(`../browser/${filename}`, import.meta.url)
        : viewerAssetUrl("browser", filename),
    );
    try {
      modules.set(filename, fs.readFileSync(candidate));
    } catch (error) {
      throw new MoklyError(
        "server-failed",
        `could not load browser client ${filename}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
  return modules;
}

/** Load shared pure navigation modules imported by the browser client. */
export function loadBrowserNavigationModules(): ReadonlyMap<string, Buffer> {
  return loadModules("../navigation", [
    "logical.js",
    "target.js",
    "delivery.js",
  ]);
}

/** Load the packaged shell fonts before the HTTP server binds. */
export function loadShellFontAssets(): ReadonlyMap<string, Buffer> {
  const fonts = new Map<string, Buffer>();
  for (const filename of ["InterVariable.woff2", "Inter-OFL.txt"]) {
    const candidate = fileURLToPath(viewerAssetUrl("fonts", filename));
    try {
      fonts.set(filename, fs.readFileSync(candidate));
    } catch (error) {
      throw new MoklyError(
        "server-failed",
        `could not load shell font ${filename}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
  return fonts;
}

function loadModules(
  _relativeDirectory: string,
  filenames: readonly string[],
): ReadonlyMap<string, Buffer> {
  const modules = new Map<string, Buffer>();
  for (const filename of filenames) {
    const candidate = fileURLToPath(viewerAssetUrl("navigation", filename));
    try {
      modules.set(filename, fs.readFileSync(candidate));
    } catch (error) {
      throw new MoklyError(
        "server-failed",
        `could not load browser module ${filename}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
  return modules;
}
