/** Private metadata shared by a shell session and its same-origin adapter. */

interface FrameSession {
  sources?: readonly string[];
}

const sessions = new WeakMap<HTMLIFrameElement, FrameSession>();

/** Record metadata without extending the public adapter contract. */
export function registerFrameSession(
  frame: HTMLIFrameElement,
  session: FrameSession,
): void {
  sessions.set(frame, session);
}

export function releaseFrameSession(
  frame: HTMLIFrameElement,
  session: FrameSession,
): void {
  if (sessions.get(frame) === session) sessions.delete(frame);
}

export function frameSession(
  frame: HTMLIFrameElement,
): FrameSession | undefined {
  return sessions.get(frame);
}
