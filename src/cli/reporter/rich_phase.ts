import {
  formatDuration,
  terminalWidth,
  truncateTerminalLine,
  type TerminalGlyphs,
} from "./terminal.js";
import type { CliOutput, ReporterPhase, TerminalEnvironment } from "./types.js";

interface ActivePhase {
  readonly startedAt: number;
  frame: number;
  label: string;
  readonly timer?: ReturnType<typeof setInterval>;
}

/** Own one rich spinner and its mutable phase label. */
export class RichPhaseRenderer {
  #active: ActivePhase | undefined;

  constructor(
    private readonly environment: TerminalEnvironment,
    private readonly glyphs: TerminalGlyphs,
    private readonly success: string,
    private readonly line: (output: CliOutput, value: string) => void,
  ) {}

  /** Clear the active spinner without writing a durable line. */
  clear(): void {
    const active = this.#active;
    if (!active) return;
    if (active.timer) clearInterval(active.timer);
    if (this.environment.stdout.isTTY)
      this.environment.stdout.write("\r\x1b[2K");
    this.#active = undefined;
  }

  /** Start one replaceable phase and return its settlement handle. */
  start(label: string): ReporterPhase {
    this.clear();
    const active: ActivePhase = {
      frame: 0,
      label,
      startedAt: this.environment.now(),
    };
    this.#active = active;
    this.render(active, !this.environment.stdout.isTTY);
    if (this.environment.stdout.isTTY) {
      const timer = setInterval(() => {
        if (this.#active !== active) return;
        active.frame++;
        this.render(active, false);
      }, 80);
      timer.unref();
      Object.assign(active, { timer });
    }
    let settled = false;
    return {
      fail: () => {
        if (settled) return;
        settled = true;
        if (this.#active === active) this.clear();
      },
      succeed: (message) => {
        if (settled) return;
        settled = true;
        const duration = this.environment.now() - active.startedAt;
        if (this.#active === active) this.clear();
        this.line(
          this.environment.stdout,
          `  ${this.success} ${message} (${formatDuration(duration)})`,
        );
      },
      update: (nextLabel) => {
        if (settled || this.#active !== active) return;
        active.label = nextLabel;
        if (this.environment.stdout.isTTY) this.render(active, false);
      },
    };
  }

  private render(active: ActivePhase, newline: boolean): void {
    const glyph =
      this.glyphs.spinner[active.frame % this.glyphs.spinner.length];
    const value = truncateTerminalLine(
      `  ${glyph} ${active.label}…`,
      terminalWidth(this.environment.stdout, this.environment.env),
    );
    this.environment.stdout.write(newline ? `${value}\n` : `\r${value}`);
  }
}
