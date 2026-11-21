import { mkdtemp, readFile, rmdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { MessageBoxOptions } from "electron";

export interface InstallLocationDependencies {
  /** True only when the updater is on: a packaged release build on macOS. */
  updates: boolean;
  platform: string;
  version: string;
  /** The executable inside `Mokly.app/Contents/MacOS`. */
  executable: string;
  userData: string;
  inApplications(): boolean;
  readOnly(folder: string): Promise<boolean>;
  showDialog(options: MessageBoxOptions): Promise<{ response: number }>;
  move(): boolean;
  warn(error: unknown): void;
}

export const moveDialog: MessageBoxOptions = {
  type: "info",
  title: "Mokly",
  message: "Move Mokly to Applications to get updates.",
  buttons: ["Move to Applications", "Not now"],
  defaultId: 0,
  cancelId: 1,
  noLink: true,
};

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

/**
 * Probe beside the app, never inside it, so the signed bundle stays unchanged.
 * Only a read-only file system counts; other errors are not a place to move from.
 */
export async function readOnlyFolder(
  folder: string,
  files: {
    mkdtemp(prefix: string): Promise<string>;
    rmdir(path: string): Promise<void>;
  } = { mkdtemp, rmdir },
): Promise<boolean> {
  let probe: string;
  try {
    probe = await files.mkdtemp(resolve(folder, ".mokly-update-probe-"));
  } catch (error) {
    if (hasCode(error, "EROFS")) return true;
    throw error;
  }
  await files.rmdir(probe);
  return false;
}

/**
 * The macOS update framework cannot replace an app on a read-only volume, such
 * as its mounted DMG or the place where macOS runs a downloaded app until the
 * user moves it. Offer the move once per version.
 */
export async function offerApplicationsMove(
  dependencies: InstallLocationDependencies,
): Promise<void> {
  try {
    if (
      !dependencies.updates ||
      dependencies.platform !== "darwin" ||
      dependencies.inApplications()
    )
      return;
    const dismissal = resolve(
      dependencies.userData,
      "install-location-dismissed-version",
    );
    try {
      if ((await readFile(dismissal, "utf8")) === dependencies.version) return;
    } catch (error) {
      if (!hasCode(error, "ENOENT")) throw error;
    }
    const bundleParent = resolve(dirname(dependencies.executable), "../../..");
    if (!(await dependencies.readOnly(bundleParent))) return;
    const { response } = await dependencies.showDialog(moveDialog);
    if (response === 0) dependencies.move();
    else await writeFile(dismissal, dependencies.version, { mode: 0o600 });
  } catch (error) {
    dependencies.warn(error);
  }
}
