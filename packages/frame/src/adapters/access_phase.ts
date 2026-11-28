import { decodeAccessMessage, type AccessToken } from "../access/channel.js";

type Stage =
  | "loading"
  | "hello"
  | "start-loading"
  | "start-loaded"
  | "reloading"
  | "reload-hello"
  | "ready"
  | "closed";

interface AccessPhase {
  request(): Promise<AccessToken>;
  send(token: AccessToken): void;
  onFailure: (() => void) | undefined;
}

/** The load and handshake of one mount, including its optional start page. */
export function frameHandshake(
  win: Window,
  hello: () => void,
  dispose: (code: "disposed" | "timeout" | "unavailable") => void,
  access?: AccessPhase,
) {
  let stage: Stage = "loading";
  let timer: number | undefined;
  let tokenSent = false;
  const starting = () => stage === "start-loading" || stage === "start-loaded";
  const failAccess = () => {
    dispose("unavailable");
    try {
      access?.onFailure?.();
    } catch (error) {
      win.reportError(error);
    }
  };
  function beginHello(afterReload: boolean) {
    stage = afterReload ? "reload-hello" : "hello";
    timer = win.setTimeout(
      afterReload ? failAccess : () => dispose("timeout"),
      5_000,
    );
    try {
      hello();
    } catch {
      if (afterReload) failAccess();
      else dispose("disposed");
    }
  }
  async function acceptRequest(route: AccessPhase) {
    if (stage !== "loading" && stage !== "hello") {
      failAccess();
      return;
    }
    win.clearTimeout(timer);
    stage = stage === "loading" ? "start-loading" : "start-loaded";
    let token: AccessToken;
    try {
      token = await route.request();
    } catch {
      if (starting()) dispose("unavailable");
      return;
    }
    if (!starting()) return;
    tokenSent = true;
    timer = win.setTimeout(failAccess, 10_000);
    try {
      route.send(token);
    } catch {
      dispose("disposed");
    }
  }
  return {
    load() {
      switch (stage) {
        case "loading":
          return beginHello(false);
        case "start-loading":
          stage = "start-loaded";
          return;
        case "reloading":
          return beginHello(true);
        case "reload-hello":
          return failAccess();
        default:
          dispose("disposed");
      }
    },
    receive(data: unknown): boolean {
      if (!access || stage === "ready" || stage === "closed") return false;
      const message = decodeAccessMessage(data);
      if (!message) return false;
      if (message.type === "request") void acceptRequest(access);
      if (message.type === "reload" && stage === "start-loaded" && tokenSent) {
        win.clearTimeout(timer);
        stage = "reloading";
      }
      if (
        message.type === "unavailable" &&
        (starting() || stage === "reloading" || stage === "reload-hello")
      )
        failAccess();
      return true;
    },
    ready(): boolean {
      if (stage !== "hello" && stage !== "reload-hello") return false;
      win.clearTimeout(timer);
      stage = "ready";
      return true;
    },
    dispose() {
      stage = "closed";
      win.clearTimeout(timer);
    },
  };
}
