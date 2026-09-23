export interface CapturedSource {
  readonly head: string;
  readonly stagedDiff: string;
  readonly files: readonly {
    readonly name: string;
    readonly kind: "file" | "link";
    readonly mode?: number;
    readonly hash?: string;
    readonly link?: string;
  }[];
  readonly fingerprint: string;
}

export function captureSource(root: string): Promise<CapturedSource>;
export function verifySource(
  root: string,
  captured: CapturedSource,
): Promise<void>;
export function createSnapshot(
  root: string,
  captured: CapturedSource,
  owner: string,
  label: string,
): Promise<string>;
export function removeSnapshot(
  root: string,
  snapshot: string,
  owner: string,
): Promise<void>;
