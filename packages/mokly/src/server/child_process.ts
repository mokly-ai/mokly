/** Native child handles retain terminal state, including failed process creation. */

import { fork, type ChildProcess } from "node:child_process";

import type { ChildCommand } from "./update_messages.js";

/** Process boundary used by the watched-child lifecycle. */
export interface ChildHandle {
  forceKill(): void;
  /** Replay IPC disconnection to late subscribers; it does not confirm process exit. */
  onDisconnect(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
  /** Replay a terminal result to late subscribers; failed spawning is terminal too. */
  onExit(callback: (code: number | null) => void): void;
  onMessage(callback: (message: unknown) => void): void;
  send(message: ChildCommand): void;
  terminate(): void;
}

/** Factory seam for child lifecycle ordering and process creation. */
export interface ChildFactory {
  spawn(arguments_: readonly string[]): ChildHandle;
}

/** Node IPC child factory. */
export class NodeChildFactory implements ChildFactory {
  constructor(private readonly binPath: string) {}

  spawn(arguments_: readonly string[]): ChildHandle {
    return new NodeChildHandle(
      fork(this.binPath, [...arguments_], {
        stdio: ["inherit", "inherit", "inherit", "ipc"],
      }),
    );
  }
}

class NodeChildHandle implements ChildHandle {
  #disconnected = false;
  #terminal: { code: number | null } | undefined;
  readonly #disconnects: Array<() => void> = [];
  readonly #exits: Array<(code: number | null) => void> = [];

  constructor(private readonly child: ChildProcess) {
    child.once("disconnect", () => {
      this.#disconnected = true;
      for (const callback of this.#disconnects.splice(0)) callback();
    });
    child.once("close", (code) => {
      this.#terminal = { code };
      for (const callback of this.#exits.splice(0)) callback(code);
    });
  }

  forceKill(): void {
    if (this.child.exitCode === null && this.child.signalCode === null)
      this.child.kill("SIGKILL");
  }

  onDisconnect(callback: () => void): void {
    if (this.#disconnected) callback();
    else this.#disconnects.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.child.on("error", callback);
  }

  onExit(callback: (code: number | null) => void): void {
    if (this.#terminal) callback(this.#terminal.code);
    else this.#exits.push(callback);
  }

  onMessage(callback: (message: unknown) => void): void {
    this.child.on("message", callback);
  }

  send(message: ChildCommand): void {
    if (this.child.connected) this.child.send(message);
  }

  terminate(): void {
    if (this.child.exitCode === null && this.child.signalCode === null)
      this.child.kill("SIGTERM");
  }
}
