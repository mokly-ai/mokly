import type { LiveNotice, LiveSignal } from "../api/types";
import { apiOrigin } from "../config";
import { liveProjectPath } from "../navigation/paths";

export type LiveState = "down" | "up";

/** The notices, recovery signals and connection state a project reader needs. */
export interface LiveSubscription {
  kinds?: readonly LiveNotice["kind"][];
  onNotice?: (notice: LiveNotice) => void;
  onResync?: () => void;
  onState?: (state: LiveState) => void;
}

export interface LiveClient {
  /** Join a project socket and return the function that leaves it. */
  subscribe: (projectId: string, subscription: LiveSubscription) => () => void;
}

interface Socket extends EventTarget {
  close: () => void;
}

interface LiveClientOptions {
  apiOrigin: string;
  openSocket: (url: URL) => Socket;
  schedule: (delayMs: number, retry: () => void) => () => void;
  random: () => number;
}

interface ProjectSocket {
  subscribers: Set<LiveSubscription>;
  state: LiveState;
  retryDelay: number;
  closeSocket?: () => void;
  cancelRetry?: () => void;
}

const firstRetryMs = 500;
const maxRetryMs = 15_000;

/** The project's WebSocket endpoint on the API origin. */
export function liveProjectUrl(origin: string, projectId: string): URL {
  const url = new URL(liveProjectPath(projectId), origin);
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol === "http:") url.protocol = "ws:";
  return url;
}

function isLiveSignal(message: unknown): message is LiveSignal {
  if (message === null || typeof message !== "object" || !("type" in message)) {
    return false;
  }
  return (
    message.type === "resync" ||
    (message.type === "notice" &&
      "kind" in message &&
      typeof message.kind === "string" &&
      "id" in message &&
      typeof message.id === "string" &&
      "sequence" in message &&
      typeof message.sequence === "number" &&
      Number.isInteger(message.sequence))
  );
}

function readSignal(data: unknown): LiveSignal | undefined {
  if (typeof data !== "string") return undefined;
  try {
    const message: unknown = JSON.parse(data);
    return isLiveSignal(message) ? message : undefined;
  } catch {
    return undefined;
  }
}

function setState(project: ProjectSocket, state: LiveState) {
  if (project.state === state) return;
  project.state = state;
  for (const subscriber of project.subscribers) subscriber.onState?.(state);
}

function resync(project: ProjectSocket) {
  for (const subscriber of project.subscribers) subscriber.onResync?.();
}

/** Share one socket per subscribed project. The caller owns member admission. */
export function createLiveClient(options: LiveClientOptions): LiveClient {
  const projects = new Map<string, ProjectSocket>();

  function connect(projectId: string, project: ProjectSocket) {
    project.cancelRetry = undefined;
    if (project.subscribers.size === 0) return;

    const retry = () => {
      const delay = project.retryDelay;
      const jitter = Math.floor(delay * options.random() * 0.2);
      project.retryDelay = Math.min(delay * 2, maxRetryMs);
      project.cancelRetry = options.schedule(delay - jitter, () =>
        connect(projectId, project),
      );
    };
    let socket: Socket;
    try {
      socket = options.openSocket(liveProjectUrl(options.apiOrigin, projectId));
    } catch {
      retry();
      return;
    }

    const events = new AbortController();
    const listener = { signal: events.signal };
    project.closeSocket = () => {
      events.abort();
      socket.close();
    };
    const disconnected = () => {
      events.abort();
      project.closeSocket = undefined;
      retry();
      setState(project, "down");
    };
    socket.addEventListener("close", disconnected, listener);
    socket.addEventListener(
      "error",
      () => {
        disconnected();
        socket.close();
      },
      listener,
    );
    socket.addEventListener(
      "open",
      () => {
        project.retryDelay = firstRetryMs;
        setState(project, "up");
        resync(project);
      },
      listener,
    );
    socket.addEventListener(
      "message",
      (event) => {
        if (project.state !== "up" || !(event instanceof MessageEvent)) return;
        const signal = readSignal(event.data);
        if (!signal) return;
        if (signal.type === "resync") {
          resync(project);
          return;
        }
        for (const subscriber of project.subscribers) {
          if (subscriber.kinds?.includes(signal.kind))
            subscriber.onNotice?.(signal);
        }
      },
      listener,
    );
  }

  return {
    subscribe(projectId, subscription) {
      const existing = projects.get(projectId);
      const project: ProjectSocket = existing ?? {
        subscribers: new Set<LiveSubscription>(),
        state: "down",
        retryDelay: firstRetryMs,
      };
      const subscriber = { ...subscription };
      project.subscribers.add(subscriber);
      if (!existing) projects.set(projectId, project);
      subscriber.onState?.(project.state);
      if (!existing) connect(projectId, project);
      return () => {
        if (!project.subscribers.delete(subscriber) || project.subscribers.size)
          return;
        projects.delete(projectId);
        project.cancelRetry?.();
        project.closeSocket?.();
      };
    },
  };
}

/** The browser connects with its API session cookie. */
export const liveClient = createLiveClient({
  apiOrigin,
  openSocket: (url) => new WebSocket(url),
  schedule: (delay, retry) => {
    const timer = setTimeout(retry, delay);
    return () => clearTimeout(timer);
  },
  random: Math.random,
});
