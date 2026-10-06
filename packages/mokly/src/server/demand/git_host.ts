/** Own worker-requested Git processes outside the terminable worker's lifetime. */
import type { MessagePort } from "node:worker_threads";

import { errorMessage } from "../../errors.js";
import { NodeGitCommandRunner } from "../../review/git.js";

import type { GitCommandReply, GitCommandRequest } from "./git_messages.js";

export class BackgroundGitHost {
  private readonly controller = new AbortController();
  private readonly runner: NodeGitCommandRunner;
  private readonly pending = new Set<Promise<void>>();
  private closed = false;
  private closing: Promise<void> | undefined;

  constructor(
    cwd: string,
    private readonly port: MessagePort,
  ) {
    this.runner = new NodeGitCommandRunner(cwd, this.controller.signal);
    port.on("message", this.receive);
    port.once("close", () => void this.close());
    port.once("messageerror", () => void this.close());
  }

  private readonly receive = (request: GitCommandRequest): void => {
    if (this.closed) return;
    const job = this.execute(request).finally(() => this.pending.delete(job));
    this.pending.add(job);
    void job.catch(() => void this.close());
  };

  private async execute(request: GitCommandRequest): Promise<void> {
    let reply: GitCommandReply;
    try {
      const bytes = await (request.input === undefined
        ? this.runner.runBytes(request.arguments)
        : this.runner.runBytesWithInput(request.arguments, request.input));
      reply = { id: request.id, ok: true, bytes };
    } catch (error) {
      reply = { id: request.id, ok: false, error: errorMessage(error) };
    }
    if (!this.closed) this.port.postMessage(reply);
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.port.off("message", this.receive);
    this.port.close();
    this.controller.abort();
    this.closing = Promise.allSettled(this.pending).then(() => {});
    return this.closing;
  }
}
