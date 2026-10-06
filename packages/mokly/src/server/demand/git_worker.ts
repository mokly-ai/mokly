/** Classification stays in the worker; its parent owns and cancels Git execution. */
import type { MessagePort } from "node:worker_threads";

import type { GitCommandRunner } from "../../review/git.js";

import type { GitCommandReply, GitCommandRequest } from "./git_messages.js";

export class WorkerGitCommandRunner implements GitCommandRunner {
  private sequence = 0;
  private closed = false;
  private readonly pending = new Map<
    number,
    { resolve(bytes: Uint8Array): void; reject(error: Error): void }
  >();

  constructor(private readonly port: MessagePort) {
    port.on("message", (reply: GitCommandReply) => {
      const job = this.pending.get(reply.id);
      if (!job) return;
      this.pending.delete(reply.id);
      if (reply.ok) job.resolve(reply.bytes);
      else job.reject(new Error(reply.error));
    });
    port.once("close", () => this.close());
    port.once("messageerror", () => this.close());
  }

  async run(arguments_: readonly string[]): Promise<string> {
    return Buffer.from(await this.runBytes(arguments_)).toString("utf8");
  }

  runBytes(arguments_: readonly string[]): Promise<Uint8Array> {
    return this.request({ id: ++this.sequence, arguments: arguments_ });
  }

  runBytesWithInput(
    arguments_: readonly string[],
    input: Uint8Array,
  ): Promise<Uint8Array> {
    return this.request({ id: ++this.sequence, arguments: arguments_, input });
  }

  private request(request: GitCommandRequest): Promise<Uint8Array> {
    if (this.closed) return Promise.reject(new Error("Git service stopped"));
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      try {
        this.port.postMessage(request);
      } catch (error) {
        this.pending.delete(request.id);
        reject(error);
      }
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const job of this.pending.values())
      job.reject(new Error("Git service stopped"));
    this.pending.clear();
    this.port.close();
  }
}
