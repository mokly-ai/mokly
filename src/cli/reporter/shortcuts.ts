import type { CliReporter, TerminalEnvironment } from "./types.js";

/** Actions owned by the running Serve lifecycle rather than terminal input. */
export interface ShortcutActions {
  clear(): void;
  close(): void;
  help(): void;
  open(): Promise<void>;
  rebuild(): void;
}

/** Own raw stdin only while rich watched Serve can consume single-key input. */
export class ServeShortcuts {
  private active = false;
  private previousRaw = false;

  constructor(
    private readonly environment: TerminalEnvironment,
    private readonly reporter: CliReporter,
    private readonly actions: ShortcutActions,
  ) {}

  /** Attach one data listener when interactive input is safe to claim. */
  start(): boolean {
    const input = this.environment.stdin;
    if (
      this.active ||
      this.reporter.mode !== "rich" ||
      !input.isTTY ||
      input.readableEnded
    )
      return false;
    this.active = true;
    this.previousRaw = input.isRaw ?? false;
    input.setRawMode?.(true);
    input.on("data", this.receive);
    input.resume();
    return true;
  }

  /** Restore the prior terminal mode and release stdin during shutdown. */
  close(): void {
    if (!this.active) return;
    this.active = false;
    const input = this.environment.stdin;
    input.off("data", this.receive);
    input.setRawMode?.(this.previousRaw);
    input.pause();
  }

  private readonly receive = (chunk: Buffer | string): void => {
    for (const key of Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk) {
      if (key === "o") void this.runOpen();
      else if (key === "r") this.actions.rebuild();
      else if (key === "c") this.actions.clear();
      else if (key === "h") this.actions.help();
      else if (key === "q" || key === "\u0003") this.actions.close();
    }
  };

  private async runOpen(): Promise<void> {
    try {
      await this.actions.open();
    } catch {
      this.reporter.warning(
        "Could not open the browser. Open the Serve URL manually.",
      );
    }
  }
}
