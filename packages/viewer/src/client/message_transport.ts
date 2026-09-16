import {
  encodeMessage,
  envelope,
  validMessage,
  type Message,
  type MessageBody,
} from "../inspector/schema.js";
import { boundedJson, BYTE_LIMIT } from "../inspector/values.js";

import type { FrameErrorCode } from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";

interface Pending {
  expected: "ack" | "boundaries";
  resolve(message: Message): void;
  reject(error: FrameError): void;
  timer: number;
}
type Request =
  | { type: "list" }
  | {
      type: "highlight";
      keys: readonly string[];
      mode: "off" | "highlight" | "pick";
    }
  | { type: "scroll-to"; key: string }
  | {
      type: "subscribe";
      events: readonly (
        "hover" | "click" | "navigation" | "pick-end" | "geometry"
      )[];
    };

/** Bounded request/reply state, independent of the DOM and inspector implementation. */
export function messageTransport(
  win: Window,
  nonce: string,
  post: (json: string) => void,
  timeout: () => void,
) {
  const pending = new Map<number, Pending>();
  let next = 0;
  let disposed = false;
  const send = (body: MessageBody) => {
    if (disposed) throw new FrameError("disposed");
    const json = encodeMessage(nonce, body);
    if (new TextEncoder().encode(json).length > BYTE_LIMIT)
      throw new FrameError("limit");
    if (!validMessage(boundedJson(json), nonce))
      throw new FrameError("invalid-message");
    post(json);
  };
  const settle = (id: number, message?: Message, code?: FrameErrorCode) => {
    const item = pending.get(id);
    if (!item) return;
    pending.delete(id);
    win.clearTimeout(item.timer);
    if (code) item.reject(new FrameError(code));
    else item.resolve(message!);
  };
  return {
    send,
    request(body: Request): Promise<Message> {
      if (disposed) return Promise.reject(new FrameError("disposed"));
      if (pending.size >= 16 || next === Number.MAX_SAFE_INTEGER)
        return Promise.reject(new FrameError("limit"));
      const requestId = ++next;
      return new Promise((resolve, reject) => {
        pending.set(requestId, {
          resolve,
          reject,
          expected: body.type === "list" ? "boundaries" : "ack",
          timer: win.setTimeout(() => {
            settle(requestId, undefined, "timeout");
            timeout();
          }, 5000),
        });
        try {
          send({ ...body, requestId });
        } catch (error) {
          settle(
            requestId,
            undefined,
            error instanceof FrameError ? error.code : "unavailable",
          );
        }
      });
    },
    receive(data: unknown): Message | undefined {
      const raw = boundedJson(data);
      if (!envelope(raw, nonce)) return;
      const id = typeof raw.requestId === "number" ? raw.requestId : undefined;
      const item = id === undefined ? undefined : pending.get(id);
      if (!validMessage(raw, nonce)) {
        if (item) settle(id!, undefined, "invalid-message");
        return;
      }
      if (id !== undefined) {
        if (item)
          settle(
            id,
            raw,
            raw.type === "error"
              ? raw.code
              : raw.type !== item.expected
                ? "invalid-message"
                : undefined,
          );
        return;
      }
      return raw;
    },
    dispose(code: FrameErrorCode = "disposed") {
      if (disposed) return;
      disposed = true;
      for (const id of pending.keys()) settle(id, undefined, code);
    },
  };
}
