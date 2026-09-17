import { readMetadata } from "./metadata.js";
import { inspectorRuntime } from "./runtime.js";
import { encodeMessage, validHostMessage, type MessageBody } from "./schema.js";
import { boundedJson, BYTE_LIMIT, origin } from "./values.js";
/** The sole pre-handshake effect is this bounded message listener. */
const win = window,
  parent = win.parent,
  doc = win.document;
const hosts = new URL(win.location.href).searchParams.getAll("mokly-host");
const host =
  hosts.length === 1 && origin(hosts[0]) && hosts[0] !== win.location.origin
    ? hosts[0]
    : undefined;
let nonce: string | undefined;
let runtime: ReturnType<typeof inspectorRuntime> | undefined;
const send = (body: MessageBody): void => {
  const json = encodeMessage(nonce!, body);
  parent.postMessage(
    json.length <= BYTE_LIMIT
      ? json
      : encodeMessage(nonce!, {
          type: "error",
          requestId: "requestId" in body ? body.requestId : null,
          code: "limit",
        }),
    host!,
  );
};
const receive = (event: MessageEvent<unknown>): void => {
  if (
    !host ||
    event.origin !== host ||
    event.source !== parent ||
    event.ports.length
  )
    return;
  const message = boundedJson(event.data);
  if (!validHostMessage(message, nonce)) return;
  const { type } = message;
  if (type === "hello") {
    if (!nonce) {
      nonce = message.nonce;
      const maps = doc.querySelectorAll<HTMLTemplateElement>(
        "template[data-mokly-inspector]",
      );
      const metadata =
        maps.length === 1
          ? readMetadata(maps[0]!.content.textContent)
          : undefined;
      runtime = inspectorRuntime(
        win,
        metadata ?? { ranges: [], links: [], error: "unavailable" },
        send,
        () => win.removeEventListener("message", receive),
      );
    }
    send({ type: "ready" });
    return;
  }
  runtime?.(message);
};
win.addEventListener("message", receive);
