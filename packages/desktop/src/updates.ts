import type { MessageBoxOptions } from "electron";

export interface Updater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  setFeedURL(options: {
    provider: "github";
    owner: string;
    repo: string;
  }): void;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
  on(
    event: "update-available" | "update-downloaded",
    handler: (info: { version: string }) => void,
  ): unknown;
  on(event: "error", handler: (error: Error) => void): unknown;
}

export function updateMode(
  packaged: boolean,
  platform: string,
  appImage: string | undefined,
): "off" | "release" | "install" {
  if (!packaged) return "off";
  return platform === "linux" && !appImage ? "release" : "install";
}

export function updateDialog(
  version: string,
  releaseOnly: boolean,
): MessageBoxOptions {
  return {
    type: "info",
    title: "Mokly",
    message: `Mokly ${version} is ready`,
    buttons: releaseOnly
      ? ["Open release page", "Later"]
      : ["Restart now", "Later"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  };
}

export interface UpdateDependencies {
  updater: Updater;
  showDialog(options: MessageBoxOptions): Promise<{ response: number }>;
  openExternal(url: string): Promise<unknown>;
  every(callback: () => void, milliseconds: number): () => void;
  warn(error: unknown): void;
}

/** Use the public pre-release feed; an unpackaged app never reaches the network. */
export function startUpdates(
  dependencies: UpdateDependencies,
  mode: ReturnType<typeof updateMode>,
) {
  if (mode === "off") return { check: () => {}, stop: () => {} };
  const { updater } = dependencies;
  updater.setFeedURL({
    provider: "github",
    owner: "mokly-ai",
    repo: "mokly-desktop",
  });
  updater.allowPrerelease = true;
  updater.autoDownload = mode === "install";
  updater.autoInstallOnAppQuit = mode === "install";
  let checking = false;
  let dialogOpen = false;
  const offered = new Set<string>();
  const offer = async ({ version }: { version: string }) => {
    if (dialogOpen || offered.has(version)) return;
    offered.add(version);
    dialogOpen = true;
    try {
      const answer = await dependencies.showDialog(
        updateDialog(version, mode === "release"),
      );
      if (answer.response !== 0) return;
      if (mode === "install") updater.quitAndInstall();
      else
        await dependencies.openExternal(
          `https://github.com/mokly-ai/mokly-desktop/releases/tag/v${encodeURIComponent(version)}`,
        );
    } catch (error) {
      dependencies.warn(error);
    } finally {
      dialogOpen = false;
    }
  };
  updater.on("error", dependencies.warn);
  updater.on(
    mode === "release" ? "update-available" : "update-downloaded",
    (info) => {
      void offer(info);
    },
  );
  const check = () => {
    if (checking) return;
    checking = true;
    void updater
      .checkForUpdates()
      .catch(dependencies.warn)
      .finally(() => {
        checking = false;
      });
  };
  check();
  const stop = dependencies.every(check, 4 * 60 * 60 * 1000);
  return { check, stop };
}
