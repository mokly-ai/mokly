/** Private request/reply protocol; only Git I/O crosses the worker boundary. */
export interface GitCommandRequest {
  id: number;
  arguments: readonly string[];
  input?: Uint8Array;
}

export type GitCommandReply =
  | { id: number; ok: true; bytes: Uint8Array }
  | { id: number; ok: false; error: string };
