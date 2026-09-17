import { spawn } from "node:child_process";

import type { CliReporter } from "./reporter/types.js";

/** Injectable default-browser boundary for Serve. */
export interface BrowserOpener {
  open(url: string): Promise<void>;
}

/** Platform process invocation for one already-validated local Serve URL. */
export interface BrowserCommand {
  readonly args: readonly string[];
  readonly command: string;
}

/** Select the native default-browser launcher without involving a shell. */
export function browserCommand(
  platform: NodeJS.Platform,
  url: string,
): BrowserCommand {
  if (platform === "darwin") return { command: "open", args: [url] };
  if (platform === "win32")
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "start", "", url],
    };
  return { command: "xdg-open", args: [url] };
}

/** Native detached browser launcher used by the real process environment. */
export class NodeBrowserOpener implements BrowserOpener {
  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  async open(url: string): Promise<void> {
    const invocation = browserCommand(this.platform, url);
    const child = spawn(invocation.command, [...invocation.args], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    await new Promise<void>((resolve, reject) => {
      const failed = (error: Error): void => reject(error);
      child.once("error", failed);
      child.once("spawn", () => {
        child.off("error", failed);
        resolve();
      });
    });
    child.unref();
  }
}

/** Open Serve without allowing desktop integration to change its lifecycle. */
export async function openServedBrowser(
  opener: BrowserOpener,
  reporter: CliReporter,
  url: string,
): Promise<boolean> {
  try {
    await opener.open(url);
    return true;
  } catch {
    reporter.warning(`Could not open the browser. Open ${url} manually.`);
    return false;
  }
}
