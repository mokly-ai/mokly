import { boundedJson, object, shape } from "../probe/values.js";

/**
 * The wire version of the frame probe that the Mokly release before wire
 * version 4 embeds in its pages. A page built with that release answers only
 * a handshake of this version.
 */
const EARLIER_VERSION = 3;

const CHANNEL = "mokly-frame-probe";

/** The handshake of the earlier probe, which a current probe ignores. */
export const earlierHello = (nonce: string): string =>
  JSON.stringify({
    channel: CHANNEL,
    version: EARLIER_VERSION,
    nonce,
    type: "hello",
  });

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
