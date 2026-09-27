/** Fixed actionable output when a checkout cannot be made remote-free. */
export const REMOVE_REMOTE_STATE_ERROR: string;

/** Remove configured remotes and every remaining remote-derived Git input. */
export function removeRemoteState(directory?: string): Promise<void>;
