/** Private watched-Serve rebuild status and strict value validation. */

/** Complete status snapshot delivered only by watched Serve. */
export interface RebuildStatus {
  readonly failure: RebuildFailure | null;
  readonly sequence: number;
  readonly updateVersion: number;
  readonly updating: boolean;
}

/** Sanitized detail for the latest source update that failed. */
export interface RebuildFailure {
  readonly detail: string;
  readonly id: number;
}

/** Maximum Unicode scalar count admitted for private failure detail. */
export const REBUILD_DETAIL_CHARACTER_LIMIT = 2_048;

/** Maximum UTF-8 byte count admitted for private failure detail. */
export const REBUILD_DETAIL_BYTE_LIMIT = 8_192;

/** Validate one exact complete snapshot before private state can adopt it. */
export function readRebuildStatus(value: unknown): RebuildStatus {
  if (
    !recordWithKeys(value, ["failure", "sequence", "updateVersion", "updating"])
  )
    throw new Error("Invalid watched rebuild status.");
  const sequence = value["sequence"];
  const updateVersion = value["updateVersion"];
  const updating = value["updating"];
  if (
    !positiveSafeInteger(sequence) ||
    !positiveSafeInteger(updateVersion) ||
    typeof updating !== "boolean"
  )
    throw new Error("Invalid watched rebuild status.");
  const failure = readFailure(value["failure"], sequence);
  return { failure, sequence, updateVersion, updating };
}

function readFailure(value: unknown, sequence: number): RebuildFailure | null {
  if (value === null) return null;
  if (!recordWithKeys(value, ["detail", "id"]))
    throw new Error("Invalid watched rebuild status.");
  const detail = value["detail"];
  const id = value["id"];
  if (
    typeof detail !== "string" ||
    detail.length === 0 ||
    !positiveSafeInteger(id) ||
    id > sequence ||
    scalarLength(detail) > REBUILD_DETAIL_CHARACTER_LIMIT ||
    new TextEncoder().encode(detail).byteLength > REBUILD_DETAIL_BYTE_LIMIT
  )
    throw new Error("Invalid watched rebuild status.");
  return { detail, id };
}

function recordWithKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
  );
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function scalarLength(value: string): number {
  return [...value].length;
}
