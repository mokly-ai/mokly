/** Poll resolved commits off HTTP; Git handles worktrees, packed refs and symbolic HEAD. */
import { ConfiguredGitCommandRunner } from "../../config/git.js";

export interface GitReferenceSource {
  read(
    root: string,
    base: string,
    signal: AbortSignal,
  ): Promise<string | undefined>;
}

export class RepositoryGitReferences implements GitReferenceSource {
  private readonly sessions = new WeakMap<
    AbortSignal,
    { root: string; git: ConfiguredGitCommandRunner }
  >();
  async read(root: string, base: string, signal: AbortSignal): Promise<string> {
    let session = this.sessions.get(signal);
    if (session?.root !== root) {
      session = {
        root,
        git: new ConfiguredGitCommandRunner({ repoRoot: root }, signal),
      };
      this.sessions.set(signal, session);
    }
    const { git } = session;
    const refs = await Promise.all(
      ["HEAD", base].map(async (ref) => {
        try {
          const commit = (
            await git.run([
              "rev-parse",
              "--verify",
              "--end-of-options",
              `${ref}^{commit}`,
            ])
          ).trim();
          return /^[a-f0-9]{40,64}$/.test(commit) ? commit : null;
        } catch {
          return null;
        }
      }),
    );
    return JSON.stringify(refs);
  }
}

export class GitReferenceObserver {
  private controller: AbortController | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sequence = 0;
  private closed = false;
  constructor(
    private readonly source: GitReferenceSource,
    private readonly changed: (initial: boolean) => void,
    private readonly intervalMs = 1000,
  ) {}

  replace(root: string, base: string): void {
    if (this.closed) return;
    this.controller?.abort();
    clearTimeout(this.timer);
    const sequence = ++this.sequence;
    const controller = (this.controller = new AbortController());
    const current = () => !this.closed && sequence === this.sequence;
    let initialized = false;
    let previous: string | undefined;
    const poll = async () => {
      let value: string | undefined;
      try {
        value = await this.source.read(root, base, controller.signal);
      } catch {
        value = undefined;
      }
      if (!current()) return;
      if (!initialized || value !== previous) {
        const initial = !initialized;
        initialized = true;
        previous = value;
        this.changed(initial);
      }
      if (current())
        this.timer = setTimeout(() => void poll(), this.intervalMs).unref();
    };
    void poll();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.sequence++;
    clearTimeout(this.timer);
    this.controller?.abort();
  }
}
