/** Aggregate overlapping preview/Props lifetimes without stale idle notifications. */
export class ForegroundActivity {
  private readonly active = new Set<symbol>();
  constructor(private readonly changed: (active: boolean) => void) {}

  channel(): (active: boolean) => void {
    const key = Symbol();
    return (active) => {
      const wasBusy = this.active.size > 0;
      if (active) this.active.add(key);
      else this.active.delete(key);
      const busy = this.active.size > 0;
      if (busy !== wasBusy) this.changed(busy);
    };
  }
}
