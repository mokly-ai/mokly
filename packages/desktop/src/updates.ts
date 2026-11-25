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
  checkForUpdates(): Promise<{
    isUpdateAvailable: boolean;
    updateInfo: { version: string };
  } | null>;
  quitAndInstall(): void;
  on(
    event: "update-available" | "update-downloaded",
    handler: (info: { version: string }) => void,
  ): unknown;
  on(event: "error", handler: (error: Error) => void): unknown;
}

/** The macOS update framework, which accepts a download before it can install. */
export interface NativeUpdater {
  on(event: "update-downloaded", handler: () => void): unknown;
  on(event: "error", handler: (error: Error) => void): unknown;
}

export type UpdateMode = "off" | "release" | "install";

/** Only a packaged release build updates itself; a deb install only learns of releases. */
export function updateMode(
  packaged: boolean,
  enabled: boolean,
  platform: string,
  appImage: string | undefined,
): UpdateMode {
  if (!packaged || !enabled) return "off";
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

export const manualAnswers = {
  current: "Mokly is up to date.",
  downloading: "Downloading the new version. Mokly tells you when it is ready.",
  failed: "Mokly could not check for updates. Try again later.",
} as const;

export function answerDialog(message: string): MessageBoxOptions {
  return {
    type: "info",
    title: "Mokly",
    message,
    buttons: ["OK"],
    noLink: true,
  };
}

export interface UpdateDependencies {
  updater: Updater;
  /** Present on macOS only. Its acceptance, not the download, makes a version ready. */
  nativeUpdater?: NativeUpdater;
  showDialog(options: MessageBoxOptions): Promise<{ response: number }>;
  openExternal(url: string): Promise<unknown>;
  every(callback: () => void, milliseconds: number): () => void;
  warn(error: unknown): void;
}

export interface Updates {
  available: boolean;
  check(): Promise<void>;
  stop(): void;
}

type Outcome = keyof typeof manualAnswers | "release";

/** Follow GitHub's latest release. Only an enabled updater reaches the network. */
export function startUpdates(
  dependencies: UpdateDependencies,
  mode: UpdateMode,
): Updates {
  if (mode === "off")
    return { available: false, check: async () => {}, stop: () => {} };
  const { updater, nativeUpdater } = dependencies;
  updater.setFeedURL({
    provider: "github",
    owner: "mokly-ai",
    repo: "mokly-desktop",
  });
  updater.allowPrerelease = false;
  updater.autoDownload = mode === "install";
  updater.autoInstallOnAppQuit = mode === "install";
  let checking: Promise<Outcome> | undefined;
  let waiting = 0;
  let downloaded: string | undefined;
  let ready: string | undefined;
  let available: string | undefined;
  let queue: Promise<void> = Promise.resolve();
  const offered = new Set<string>();

  // One native dialog at a time; a failed dialog never stops the next one.
  const show = (dialog: () => Promise<void>) => {
    queue = queue.then(dialog).catch(dependencies.warn);
    return queue;
  };
  const offer = (version: string, manual = false) => {
    if (!manual && offered.has(version)) return queue;
    offered.add(version);
    return show(async () => {
      const answer = await dependencies.showDialog(
        updateDialog(version, mode === "release"),
      );
      if (answer.response !== 0) return;
      if (mode === "install") updater.quitAndInstall();
      else
        await dependencies.openExternal(
          `https://github.com/mokly-ai/mokly-desktop/releases/tag/v${encodeURIComponent(version)}`,
        );
    });
  };
  const accept = (version: string) => {
    ready = version;
    if (waiting === 0) void offer(version);
  };

  updater.on("error", dependencies.warn);
  nativeUpdater?.on("error", dependencies.warn);
  if (mode === "release")
    updater.on("update-available", ({ version }) => {
      available = version;
      if (waiting === 0) void offer(version);
    });
  else
    updater.on("update-downloaded", ({ version }) => {
      downloaded = version;
      if (!nativeUpdater) accept(version);
    });
  nativeUpdater?.on("update-downloaded", () => {
    if (downloaded) accept(downloaded);
  });

  const query = async (): Promise<Outcome> => {
    try {
      const result = await updater.checkForUpdates();
      if (!result) return "failed";
      if (!result.isUpdateAvailable) return "current";
      if (mode === "install") return "downloading";
      available = result.updateInfo.version;
      return "release";
    } catch (error) {
      dependencies.warn(error);
      return "failed";
    }
  };
  const automatic = () => {
    checking ??= query().finally(() => {
      checking = undefined;
    });
    return checking;
  };
  const check = async () => {
    if (ready) return offer(ready, true);
    waiting++;
    const outcome = await automatic().finally(() => {
      waiting--;
    });
    if (ready) return offer(ready, true);
    if (outcome === "release" && available) return offer(available, true);
    if (outcome === "release") return;
    return show(async () => {
      await dependencies.showDialog(answerDialog(manualAnswers[outcome]));
    });
  };
  void automatic();
  return {
    available: true,
    check,
    stop: dependencies.every(() => void automatic(), 4 * 60 * 60 * 1000),
  };
}
