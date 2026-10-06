import type {
  MoveCandidate,
  MoveSignals,
} from "../../packages/mokly/src/review/moves/types.js";

export function moveEntry(
  path: string,
  fields: Partial<MoveCandidate> = {},
): MoveCandidate {
  return {
    kind: "screen",
    path,
    title: path,
    sourcePath: `specs/${path}.mockup.tsx`,
    ...fields,
  };
}

export function moveSignals(fields: Partial<MoveSignals> = {}): MoveSignals {
  return { identical: () => false, similarity: () => 0, ...fields };
}
