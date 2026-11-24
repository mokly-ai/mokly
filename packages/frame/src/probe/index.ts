import { inspectionError } from "./inspection.js";
import { probeNavigation } from "./links.js";
import { readMetadata, unavailableMetadata } from "./metadata.js";
import { probeRuntime } from "./runtime.js";
import { encodeMessage, validHostMessage, type MessageBody } from "./schema.js";
import { boundedJson, BYTE_LIMIT, origin } from "./values.js";
/** The sole pre-handshake effect is this bounded message listener. */
const win = window,
  parent = win.parent;
const hosts = new URL(win.location.href).searchParams.getAll("mokly-host");
const host =
  hosts.length === 1 && origin(hosts[0]) && hosts[0] !== win.location.origin
    ? hosts[0]
    : undefined;
let nonce: string | undefined;
let runtime: ReturnType<typeof probeRuntime> | undefined;
let lastRequest = 0;
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
      const maps = win.document.querySelectorAll<HTMLTemplateElement>(
        "template[data-mokly-frame-probe]",
      );
      const metadata =
        maps.length === 1
          ? readMetadata(maps[0]!.content.textContent)
          : undefined;
      const accepted = metadata ?? unavailableMetadata("unavailable");
      runtime = probeRuntime(
        win,
        accepted,
        win,
        probeNavigation(accepted),
        (event) =>
          send(event.type === "error" ? { ...event, requestId: null } : event),
        () => win.removeEventListener("message", receive),
      );
    }
    send({ type: "ready" });
    return;
  }
  if (!runtime) return;
  if (type === "dispose") return runtime.__dispose();
  const { requestId } = message;
  if (requestId <= lastRequest) return;
  lastRequest = requestId;
  try {
    if (type === "highlight") runtime.__highlight(message.keys, message.mode);
    else if (type === "scroll-to") runtime.__scroll(message.key);
    else if (type === "subscribe") runtime.__subscribe(message.events);
    const reply =
      type === "list"
        ? { type: "boundaries" as const, boundaries: runtime.__list() }
        : type === "measure"
          ? {
              type: "box-model" as const,
              boxModel: runtime.__boxModel(message.key),
            }
          : type === "measure-content"
            ? {
                type: "content-box" as const,
                contentBox: runtime.__contentBox(),
              }
            : { type: "ack" as const };
    send({ requestId, ...reply });
  } catch (error) {
    send({ type: "error", requestId, code: inspectionError(error) });
  }
};
win.addEventListener("message", receive);
