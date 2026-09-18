/** Storage subset used for one-shot reload recovery. */

import { parseBrowseRecoveryState } from "@mokly/viewer/runtime";
import type { BrowseRecoveryState } from "@mokly/viewer/runtime";
export interface RecoveryStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

/** Browser location subset used by live updates. */
export interface ReloadLocation {
  href: string;
  reload(): void;
}

/** Event stream subset used by the package client. */
export interface UpdateEventStream {
  close(): void;
  onReady(callback: (version: number) => void): void;
  onUpdate(callback: (version: number) => void): void;
}

/** One-shot recovery payload consumed after an automatic reload. */
export interface RecoveryState {
  browse?: BrowseRecoveryState;
  url: string;
  version: number;
}

const RECOVERY_KEY = "mokly:live-update-recovery";

/** Coordinate latest-wins refreshes and one-shot reload recovery. */
export class LiveUpdateController {
  #lastVersion: number;
  readonly #pageVersionKnown: boolean;
  #pending: AbortController | undefined;
  #closed = false;

  constructor(
    private readonly stream: UpdateEventStream,
    private readonly storage: RecoveryStorage,
    private readonly location: ReloadLocation,
    private readonly captureBrowseState: () =>
      BrowseRecoveryState | undefined = () => undefined,
    pageVersion?: number,
    private readonly refresh?: (
      version: number,
      signal: AbortSignal,
    ) => Promise<number | undefined>,
  ) {
    const knownPageVersion = isUpdateVersion(pageVersion) ? pageVersion : 0;
    this.#pageVersionKnown = knownPageVersion > 0;
    this.#lastVersion = knownPageVersion;
  }

  /** Begin receiving server update versions. */
  start(): void {
    this.stream.onReady((version) => this.receive(version, false));
    this.stream.onUpdate((version) => this.receive(version, true));
  }

  /** Close the stream when the shell unmounts. */
  close(): void {
    this.#closed = true;
    this.#pending?.abort();
    this.stream.close();
  }

  /** Consume recovery exactly once; later manual refreshes see no stale state. */
  consumeRecovery(): RecoveryState | undefined {
    const raw = this.storage.getItem(RECOVERY_KEY);
    this.storage.removeItem(RECOVERY_KEY);
    if (!raw) return undefined;
    try {
      const value = JSON.parse(raw) as {
        browse?: unknown;
        url?: unknown;
        version?: unknown;
      };
      if (typeof value.url !== "string" || !Number.isSafeInteger(value.version))
        return undefined;
      const browse =
        value.browse === undefined
          ? undefined
          : parseBrowseRecoveryState(value.browse);
      if (value.browse !== undefined && !browse) return undefined;
      return {
        ...(browse ? { browse } : {}),
        url: value.url,
        version: value.version as number,
      };
    } catch {
      return undefined;
    }
  }

  private receive(version: number, forceReload: boolean): void {
    if (
      this.#closed ||
      !isUpdateVersion(version) ||
      version <= this.#lastVersion
    )
      return;
    const initialReady =
      !this.#pageVersionKnown && this.#lastVersion === 0 && !forceReload;
    this.#lastVersion = version;
    if (initialReady) return;
    this.#pending?.abort();
    if (this.refresh) {
      const pending = new AbortController();
      this.#pending = pending;
      void this.refresh(version, pending.signal)
        .then((applied) => {
          if (pending.signal.aborted || this.#closed) return;
          if (isUpdateVersion(applied) && applied >= version)
            this.#lastVersion = Math.max(this.#lastVersion, applied);
          else this.reload(version);
        })
        .catch(() => {
          if (!pending.signal.aborted && !this.#closed) this.reload(version);
        });
    } else this.reload(version);
  }

  private reload(version: number): void {
    const browse = this.captureBrowseState();
    const recovery: RecoveryState = {
      ...(browse ? { browse } : {}),
      url: this.location.href,
      version,
    };
    this.storage.setItem(RECOVERY_KEY, JSON.stringify(recovery));
    this.location.reload();
  }
}

function isUpdateVersion(value: number | undefined): value is number {
  return Number.isSafeInteger(value) && value !== undefined && value > 0;
}
