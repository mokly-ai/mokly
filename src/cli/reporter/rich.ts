import type { ManifestV5 } from "@mokly/viewer/data";

import { errorMessage } from "../../errors.js";
import type { ServeReadyReport, WatchReport } from "../../server/reporter.js";
import { cliErrorPresentation } from "../errors.js";

import {
  catalogueCounts,
  reportPaths,
  watchCopy,
  watchTimestamp,
} from "./serve_lines.js";
import {
  formatDuration,
  terminalGlyphs,
  terminalStyle,
  terminalWidth,
  truncateTerminalLine,
} from "./terminal.js";
import type {
  CliOutput,
  CliReporter,
  ReporterPhase,
  TerminalEnvironment,
} from "./types.js";

interface ActivePhase {
  readonly startedAt: number;
  frame: number;
  readonly label: string;
  readonly timer?: ReturnType<typeof setInterval>;
}

/** TTY-oriented reporter that owns one spinner and all terminal writes. */
export class RichReporter implements CliReporter {
  readonly mode = "rich" as const;
  readonly #glyphs;
  #active: ActivePhase | undefined;
  #serveReport: ServeReadyReport | undefined;
  #servePhase: ReporterPhase | undefined;

  constructor(readonly environment: TerminalEnvironment) {
    this.#glyphs = terminalGlyphs(environment.platform, environment.env);
  }

  close(): void {
    this.#servePhase = undefined;
    this.clearPhase();
  }

  clearServe(): void {
    this.settleServePhase();
    this.environment.stdout.write("\x1b[2J\x1b[H");
    if (this.#serveReport) this.serveReady(this.#serveReport);
  }

  baselinePreparing(base: string): void {
    this.settleServePhase();
    this.#servePhase = this.startPhase(
      `Preparing comparison baseline from ${base}`,
    );
  }

  baselineReady(commit: string, cacheHit: boolean, durationMs: number): void {
    this.settleServePhase();
    this.line(
      this.environment.stdout,
      `  ${this.#glyphs.success} Baseline ready · ${cacheHit ? "reused" : "rebuilt"} ${commit.slice(0, 8)} (${formatDuration(durationMs)})`,
    );
    this.#servePhase = this.startPhase("Checking changes");
  }

  catalogueReady(manifest: ManifestV5, durationMs: number): void {
    this.settleServePhase();
    const counts = catalogueCounts(manifest);
    this.line(
      this.environment.stdout,
      `  ${this.#glyphs.success} Catalogue ready${counts.length > 0 ? ` · ${counts.join(" · ")}` : ""} (${formatDuration(durationMs)})`,
    );
    this.#servePhase = this.startPhase("Checking changes");
  }

  changesReady(changed: number, durationMs: number): void {
    this.settleServePhase();
    this.line(
      this.environment.stdout,
      `  ${this.#glyphs.success} Changes ready · ${changed} changed ${changed === 1 ? "screen" : "screens"} (${formatDuration(durationMs)})`,
    );
  }

  changesUnavailable(durationMs: number): void {
    this.settleServePhase();
    this.line(
      this.environment.stdout,
      `  ${this.#glyphs.warning} Changes unavailable (${formatDuration(durationMs)})`,
    );
  }

  diagnostic(message: string): void {
    this.clearPhase();
    for (const line of message.split("\n"))
      this.line(this.environment.stderr, line);
  }

  gitReferenceRefresh(_base: string): void {}

  renderError(error: unknown, redact: (value: string) => string): void {
    this.clearPhase();
    const presentation = cliErrorPresentation(error);
    const code = presentation.code
      ? `  ${terminalStyle(
          this.environment,
          this.environment.stderr,
          "dim",
          `[mokly/${presentation.code}]`,
        )}`
      : "";
    this.line(
      this.environment.stderr,
      redact(`  ${this.#glyphs.failure} ${presentation.headline}${code}`),
    );
    if (presentation.detail)
      for (const detail of presentation.detail.split("\n"))
        this.line(this.environment.stderr, redact(`    ${detail}`));
    this.line(
      this.environment.stderr,
      terminalStyle(
        this.environment,
        this.environment.stderr,
        "dim",
        redact(`    ${presentation.hint}`),
      ),
    );
  }

  runtimeDiagnostic(error: unknown): void {
    this.clearPhase();
    const lines = errorMessage(error).split("\n");
    this.line(
      this.environment.stderr,
      `  ${this.#glyphs.failure} ${lines.shift() ?? "Serve failed."}`,
    );
    for (const detail of lines)
      this.line(this.environment.stderr, `    ${detail}`);
  }

  serveReady(report: ServeReadyReport): void {
    this.clearPhase();
    this.#serveReport = report;
    this.line(
      this.environment.stdout,
      `  mokly ${report.version}  ${report.generatedOutput} · comparing against ${report.base}`,
    );
    this.line(this.environment.stdout, `  ${report.configPath}`);
    this.environment.stdout.write("\n");
    this.line(
      this.environment.stdout,
      `  ${this.#glyphs.url}  ${report.url}  ${report.watch ? "watching entries, renderer and styles" : "snapshot"}`,
    );
    if (report.watch && this.environment.stdin.isTTY)
      this.line(this.environment.stdout, "     press h for shortcuts");
    this.environment.stdout.write("\n");
  }

  startPhase(label: string): ReporterPhase {
    this.clearPhase();
    const active: ActivePhase = {
      frame: 0,
      label,
      startedAt: this.environment.now(),
    };
    this.#active = active;
    this.renderPhase(active, !this.environment.stdout.isTTY);
    if (this.environment.stdout.isTTY) {
      const timer = setInterval(() => {
        if (this.#active !== active) return;
        active.frame++;
        this.renderPhase(active, false);
      }, 80);
      timer.unref();
      Object.assign(active, { timer });
    }
    let settled = false;
    return {
      fail: () => {
        if (settled) return;
        settled = true;
        if (this.#active === active) this.clearPhase();
      },
      succeed: (message) => {
        if (settled) return;
        settled = true;
        const duration = this.environment.now() - active.startedAt;
        if (this.#active === active) this.clearPhase();
        this.line(
          this.environment.stdout,
          `  ${this.#glyphs.success} ${message} (${formatDuration(duration)})`,
        );
      },
    };
  }

  showShortcuts(): void {
    this.clearPhase();
    for (const line of [
      "  Shortcuts",
      "    o  open browser",
      "    r  rebuild catalogue",
      "    c  clear terminal",
      "    h  show shortcuts",
      "    q  quit",
    ])
      this.line(this.environment.stdout, line);
  }

  summary(_plain: string, rich: string, durationMs: number): void {
    this.clearPhase();
    this.line(
      this.environment.stdout,
      `  ${this.#glyphs.success} ${rich} (${formatDuration(durationMs)})`,
    );
  }

  warning(message: string): void {
    this.clearPhase();
    this.line(this.environment.stderr, `  ${this.#glyphs.warning} ${message}`);
  }

  watchFailed(report: WatchReport, error: unknown): void {
    this.settleServePhase();
    this.line(
      this.environment.stderr,
      `  ${watchTimestamp(this.environment.now())}  ${this.#glyphs.failure} ${reportPaths(report)}`,
    );
    for (const detail of errorMessage(error).split("\n"))
      this.line(this.environment.stderr, `            ${detail}`);
    this.line(
      this.environment.stderr,
      "            The last good catalogue is still being served.",
    );
  }

  watchFinished(report: WatchReport): void {
    this.settleServePhase();
    const copy = watchCopy(report.action, this.#glyphs);
    this.line(
      this.environment.stdout,
      `  ${watchTimestamp(this.environment.now())}  ${copy.glyph} ${reportPaths(report)}  ${copy.complete}  ${formatDuration(report.durationMs)}`,
    );
  }

  watchStarted(report: WatchReport): void {
    this.settleServePhase();
    const copy = watchCopy(report.action, this.#glyphs);
    this.#servePhase = this.startPhase(`${copy.active} ${reportPaths(report)}`);
  }

  write(value: string): void {
    this.clearPhase();
    this.environment.stdout.write(value);
  }

  private clearPhase(): void {
    const active = this.#active;
    if (!active) return;
    if (active.timer) clearInterval(active.timer);
    if (this.environment.stdout.isTTY)
      this.environment.stdout.write("\r\x1b[2K");
    this.#active = undefined;
  }

  private line(output: CliOutput, value: string): void {
    output.write(
      `${truncateTerminalLine(value, terminalWidth(output, this.environment.env))}\n`,
    );
  }

  private settleServePhase(): void {
    this.#servePhase?.fail();
    this.#servePhase = undefined;
  }

  private renderPhase(active: ActivePhase, newline: boolean): void {
    const glyph =
      this.#glyphs.spinner[active.frame % this.#glyphs.spinner.length];
    const value = truncateTerminalLine(
      `  ${glyph} ${active.label}…`,
      terminalWidth(this.environment.stdout, this.environment.env),
    );
    this.environment.stdout.write(newline ? `${value}\n` : `\r${value}`);
  }
}
