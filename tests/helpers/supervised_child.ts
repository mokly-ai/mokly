import type {
  ChildFactory,
  ChildHandle,
} from "../../dist/server/child_process.js";
import type { ChildCommand } from "../../dist/server/update_messages.js";

/** Controllable child that retains exit state and otherwise ignores shutdown. */
class ControlledChild implements ChildHandle {
  readonly messages: ChildCommand[] = [];
  terminations = 0;
  forceKills = 0;
  throwOnSend = false;
  exitOnShutdown = false;
  disconnectOnShutdown = false;
  private disconnected = false;
  private stopped: { code: number | null } | undefined;
  private readonly disconnects: Array<() => void> = [];
  private readonly errors: Array<(error: Error) => void> = [];
  private readonly exits: Array<(code: number | null) => void> = [];
  private readonly receives: Array<(message: unknown) => void> = [];

  forceKill(): void {
    this.forceKills++;
  }
  terminate(): void {
    this.terminations++;
  }

  onError(callback: (error: Error) => void): void {
    this.errors.push(callback);
  }
  onDisconnect(callback: () => void): void {
    if (this.disconnected) callback();
    else this.disconnects.push(callback);
  }
  onMessage(callback: (message: unknown) => void): void {
    this.receives.push(callback);
  }
  onExit(callback: (code: number | null) => void): void {
    if (this.stopped) callback(this.stopped.code);
    else this.exits.push(callback);
  }

  send(message: ChildCommand): void {
    this.messages.push(message);
    if (this.throwOnSend) throw new Error("IPC send failed");
    if (this.disconnectOnShutdown && message.type === "shutdown")
      this.disconnect();
    if (this.exitOnShutdown && message.type === "shutdown") this.exit(0);
  }

  ready(): void {
    for (const callback of this.receives)
      callback({ port: 48123, type: "ready" });
  }
  fail(): void {
    for (const callback of this.errors)
      callback(new Error("child transport failed"));
  }
  disconnect(): void {
    if (this.disconnected) return;
    this.disconnected = true;
    for (const callback of this.disconnects.splice(0)) callback();
  }
  exit(code: number | null): void {
    if (this.stopped) return;
    this.stopped = { code };
    for (const callback of this.exits.splice(0)) callback(code);
  }
}

/** Record every spawn so tests can detect replacement before confirmed exit. */
export class ControlledChildFactory implements ChildFactory {
  readonly children: ControlledChild[] = [];
  readonly arguments_: string[][] = [];
  alreadyExited = false;
  alreadyDisconnected = false;

  spawn(args: readonly string[]): ChildHandle {
    const child = new ControlledChild();
    this.children.push(child);
    this.arguments_.push([...args]);
    if (this.alreadyExited) child.exit(17);
    if (this.alreadyDisconnected) child.disconnect();
    return child;
  }

  finish(): void {
    for (const child of this.children) child.exit(0);
  }
}

/** Observe settlement without throwing an unhandled rejection during a timing assertion. */
export function settlement(promise: Promise<unknown>) {
  const state: {
    status: "pending" | "resolved" | "rejected";
    error?: unknown;
  } = { status: "pending" };
  void promise.then(
    () => {
      state.status = "resolved";
    },
    (error) => {
      state.status = "rejected";
      state.error = error;
    },
  );
  return state;
}

/** Drain promise continuations without advancing mocked shutdown timers. */
export async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
