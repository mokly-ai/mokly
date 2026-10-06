import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { projectRealPath } from "../config/paths.js";

import { exportError } from "./error.js";

/** Reserved, persistent namespace for filesystem-native per-output locks. */
export const RESERVATION_DIRECTORY = ".mokly-export-reservations";
const OWNER = ".owner";
const OWNER_CONTENT = "mokly-export-reservations-v1\n";

/** Preserve native filename equivalence instead of hashing caller spelling. */
export function reservationPath(output: string): string {
  const real = projectRealPath(output);
  return path.join(
    path.dirname(real),
    RESERVATION_DIRECTORY,
    "locks",
    path.basename(real),
  );
}

/** Recognize only an explicitly initialized internal reservation namespace. */
export function isReservationDirectory(directory: string): boolean {
  if (path.basename(directory) !== RESERVATION_DIRECTORY) return false;
  try {
    const root = fs.lstatSync(directory);
    const marker = path.join(directory, OWNER);
    const stat = fs.lstatSync(marker);
    return (
      root.isDirectory() &&
      !root.isSymbolicLink() &&
      stat.isFile() &&
      stat.size === OWNER_CONTENT.length &&
      fs.readFileSync(marker, "utf8") === OWNER_CONTENT
    );
  } catch {
    return false;
  }
}

/** Initialize metadata without adopting unowned directories or old reservations. */
export async function prepareReservation(output: string): Promise<void> {
  const parent = path.dirname(output);
  await fs.promises.mkdir(parent, { recursive: true });
  const old = (await fs.promises.readdir(parent)).find((name) =>
    /^\.mokly-export-[a-f0-9]{20}\.lock$/.test(name),
  );
  if (old)
    throw exportError(
      `Legacy export reservation requires explicit recovery: ${path.join(parent, old)}. Confirm no writer is active before recovering it.`,
    );
  const directory = path.join(parent, RESERVATION_DIRECTORY);
  try {
    await fs.promises.mkdir(directory);
    await fs.promises.mkdir(path.join(directory, "locks"));
    await fs.promises.writeFile(path.join(directory, OWNER), OWNER_CONTENT, {
      flag: "wx",
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    for (
      let attempt = 0;
      attempt < 50 && !isReservationDirectory(directory);
      attempt++
    ) {
      if (!fs.lstatSync(directory).isDirectory()) break;
      await delay(10);
    }
  }
  if (!isReservationDirectory(directory))
    throw exportError(
      `Export reservation namespace is unowned or incomplete: ${directory}. Inspect it before explicitly recovering it.`,
    );
  const locks = await fs.promises.lstat(path.join(directory, "locks"));
  if (!locks.isDirectory() || locks.isSymbolicLink())
    throw exportError(
      `Export reservation locks must be a real directory: ${directory}`,
    );
}
