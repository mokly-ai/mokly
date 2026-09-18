import fs from "node:fs";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";

import { EXPORT_MARKER, parseExportOwnership } from "./ownership.js";
import { isReservationDirectory } from "./reservation.js";
import { exportReservation, TRANSACTION_MARKER } from "./transaction.js";

/** Recognize proven output/reservations, not unrelated similarly named files. */
export function isExportIgnoredPath(
  candidate: string,
  repoRoot: string,
  mode: "traverse" | "event" = "event",
): boolean {
  for (
    let directory = candidate;
    isInside(repoRoot, directory) && directory !== repoRoot;
    directory = path.dirname(directory)
  ) {
    const content = readMarker(directory, EXPORT_MARKER);
    const ownership = content ? parseExportOwnership(content) : undefined;
    if (ownership) {
      const relative = toPosixPath(path.relative(directory, candidate));
      if (relative === EXPORT_MARKER || ownership.files.includes(relative))
        return true;
      if (
        mode === "event" &&
        (relative === "" ||
          ownership.files.some((file) => file.startsWith(`${relative}/`)))
      )
        return true;
      return false;
    }
    if (isReservationDirectory(directory)) return true;
    if (validReservation(directory)) return true;
    try {
      if (validReservation(exportReservation(directory))) return true;
    } catch {
      // A disappearing unowned path is not proof of export ownership.
    }
  }
  return false;
}

function validReservation(directory: string): boolean {
  const content = readMarker(directory, TRANSACTION_MARKER);
  if (!content) return false;
  try {
    const value: unknown = JSON.parse(content);
    if (
      !value ||
      typeof value !== "object" ||
      !("schemaVersion" in value) ||
      value.schemaVersion !== 2 ||
      !("output" in value) ||
      typeof value.output !== "string" ||
      !isSafeRepositoryPath(value.output) ||
      value.output.includes("/")
    )
      return false;
    return (
      projectRealPath(
        exportReservation(
          path.join(
            path.dirname(path.dirname(path.dirname(directory))),
            value.output,
          ),
        ),
      ) === projectRealPath(directory)
    );
  } catch {
    return false;
  }
}

function readMarker(directory: string, marker: string): string | undefined {
  try {
    const candidate = path.join(directory, marker);
    const stat = fs.lstatSync(candidate);
    return stat.isFile() && stat.size <= 8 * 1024 * 1024
      ? fs.readFileSync(candidate, "utf8")
      : undefined;
  } catch {
    return undefined;
  }
}
