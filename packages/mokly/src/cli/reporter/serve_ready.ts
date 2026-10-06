import type { ServeReadyReport } from "../../server/reporter.js";

import { serveUrlPanel } from "./serve_lines.js";
import {
  terminalStyle,
  terminalWidth,
  type TerminalGlyphs,
} from "./terminal.js";
import type { TerminalEnvironment } from "./types.js";

/** Render the rich Serve header, prominent URL panel, and secondary status. */
export function renderServeReady(
  report: ServeReadyReport,
  environment: TerminalEnvironment,
  glyphs: TerminalGlyphs,
  line: (value: string) => void,
): void {
  line(
    `  mokly ${report.version}  ${report.generatedOutput} · comparing against ${report.base}`,
  );
  line(`  ${report.configPath}`);
  line("");
  const width = terminalWidth(environment.stdout, environment.env);
  for (const [index, value] of serveUrlPanel(
    report.url,
    width,
    glyphs,
  ).entries()) {
    line(
      terminalStyle(
        environment,
        environment.stdout,
        index === 1 ? ["bold", "cyan"] : "cyan",
        value,
      ),
    );
  }
  const shortcut =
    report.watch && environment.stdin.isTTY ? " · press h for shortcuts" : "";
  const status = report.watch
    ? `watching entries, renderer and styles${shortcut}`
    : "snapshot";
  line(terminalStyle(environment, environment.stdout, "dim", `  ${status}`));
  line("");
}
