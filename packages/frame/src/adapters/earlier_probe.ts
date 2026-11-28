import { boundedJson, object, shape } from "../probe/values.js";

/**
 * The wire version of the frame probe that the Mokly release before wire
 * version 4 embeds in its pages. A page built with that release answers only
 * a handshake of this version.
 */
const EARLIER_VERSION = 3;

const CHANNEL = "mokly-frame-probe";

/**
 * The handshake of the earlier probe and, right after it, its disposal. A
 * current probe ignores both. An earlier probe answers the handshake with
 * `ready` and then stops the work that the handshake started, because the
 * mount never runs its session.
 */
export const earlierHandshake = (nonce: string): readonly string[] =>
  (["hello", "dispose"] as const).map((type) =>
    JSON.stringify({ channel: CHANNEL, version: EARLIER_VERSION, nonce, type }),
  );

/** Whether a message is the earlier probe's answer to this mount's handshake. */
export const earlierReady = (data: unknown, nonce: string): boolean => {
  const value = boundedJson(data);
  return (
    object(value) &&
    shape(value, 4) &&
    value.channel === CHANNEL &&
    value.version === EARLIER_VERSION &&
    value.nonce === nonce &&
    value.type === "ready"
  );
};
