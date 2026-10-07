/** Deduplicate an earlier-version notice only for the currently accepted base. */
export class BaselineNoticeState {
  private commit: string | undefined;
  private reported = false;

  accept(commit: string): void {
    if (commit === this.commit) return;
    this.commit = commit;
    this.reported = false;
  }

  take(commit: string): boolean {
    this.accept(commit);
    if (this.reported) return false;
    this.reported = true;
    return true;
  }
}
