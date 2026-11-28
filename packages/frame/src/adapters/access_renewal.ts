import {
  encodeAccessMessage,
  validAccessToken,
  type AccessToken,
} from "../access/channel.js";

import { FrameError } from "./frame_error.js";

const RENEWAL_LEAD = 60_000;
const MIN_CALL_INTERVAL = 10_000;
const MAX_TIMER_DELAY = 2_147_483_647;

type Send = (message: string) => void;
interface ReceiverGroup {
  frames: Set<Send>;
  stopListening(): void;
}

/** One renewal clock for all mounts of an adapter. */
export function accessRenewal(access: () => Promise<AccessToken>) {
  const receivers = new Map<Window, ReceiverGroup>();
  let token: AccessToken | undefined;
  let lastCallAt = 0;
  let renewing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const dueAt = () =>
    token &&
    Math.max(token.expiresAt - RENEWAL_LEAD, lastCallAt + MIN_CALL_INTERVAL);
  function schedule() {
    clearTimeout(timer);
    const due = dueAt();
    if (due === undefined || renewing || !receivers.size) return;
    const delay = Math.min(Math.max(due - Date.now(), 0), MAX_TIMER_DELAY);
    timer = setTimeout(checkDue, delay);
  }
  async function request(): Promise<AccessToken> {
    lastCallAt = Date.now();
    schedule();
    const current: unknown = await access();
    if (!validAccessToken(current) || current.expiresAt <= Date.now())
      throw new FrameError("unavailable");
    return { token: current.token, expiresAt: current.expiresAt };
  }
  function remember(current: AccessToken) {
    if (!token || current.expiresAt >= token.expiresAt) token = current;
    schedule();
  }
  async function renew() {
    renewing = true;
    try {
      const current = await request();
      if (!receivers.size) return;
      remember(current);
      const message = encodeAccessMessage({ type: "token", ...current });
      for (const { frames } of receivers.values()) {
        for (const send of frames) {
          try {
            send(message);
          } catch {
            // The frame may have unloaded.
          }
        }
      }
    } catch {
      // Keep the current expiry to calculate the next renewal.
    } finally {
      renewing = false;
      schedule();
    }
  }
  function checkDue() {
    const due = dueAt();
    if (due === undefined || renewing || !receivers.size) return;
    if (due <= Date.now()) void renew();
    else schedule();
  }
  function listen(win: Window): ReceiverGroup {
    const controller = new AbortController();
    const { signal } = controller;
    const visible = () => {
      if (win.document.visibilityState === "visible") checkDue();
    };
    win.document.addEventListener("visibilitychange", visible, { signal });
    win.addEventListener("pageshow", checkDue, { signal });
    const group: ReceiverGroup = {
      frames: new Set(),
      stopListening() {
        controller.abort();
      },
    };
    receivers.set(win, group);
    return group;
  }
  return {
    request,
    remember,
    add(win: Window, send: Send) {
      const group = receivers.get(win) ?? listen(win);
      group.frames.add(send);
      schedule();
      return () => {
        group.frames.delete(send);
        if (!group.frames.size) {
          receivers.delete(win);
          group.stopListening();
        }
        schedule();
      };
    },
  };
}
